using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

public sealed record HistoryIssueDto(Guid Id, Guid WorkerId, string WorkerNo, string Name, string? ProjectName, string Code, DateOnly? On, string Details, string? SourceNo);

/// <summary>The issues report: counts by kind (the cards), and the issues of the current filter.</summary>
public sealed record HistoryIssueListDto(int Total, IReadOnlyDictionary<string, int> Counts, int Workers, DateTimeOffset? BuiltAt, string? Summary, IReadOnlyList<HistoryIssueDto> Items);

/// <summary>What does not add up in the workers' history from the old system.</summary>
internal sealed class HistoryQueries(WorkforceDbContext db)
{
    public async Task<HistoryIssueListDto> IssuesAsync(string? code, string? search, Guid? workerId, int page, int pageSize, CancellationToken cancellationToken)
    {
        var all = db.HistoryIssues.AsNoTracking().Where(i => workerId == null || i.WorkerId == workerId);
        var counts = await all.GroupBy(i => i.Code).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken).ConfigureAwait(false);
        var workers = await all.Select(i => i.WorkerId).Distinct().CountAsync(cancellationToken).ConfigureAwait(false);
        var query = all.Where(i => code == null || i.Code == code)
            .Join(db.Workers, i => i.WorkerId, w => w.Id, (i, w) => new { Issue = i, Worker = w })
            .Join(db.People, x => x.Worker.PersonId, p => p.Id, (x, p) => new { x.Issue, x.Worker, Person = p });
        if (search?.Trim() is { Length: > 0 } text)
        {
            var upper = text.ToUpperInvariant();
            query = query.Where(x => x.Worker.WorkerNo.Contains(upper) || x.Person.NameEn.Contains(text) || x.Issue.Details.Contains(text)
                || (x.Issue.SourceNo != null && x.Issue.SourceNo.Contains(upper)) || (x.Worker.ProjectName != null && x.Worker.ProjectName.Contains(text)));
        }

        var total = await query.CountAsync(cancellationToken).ConfigureAwait(false);
        var size = Math.Clamp(pageSize, 10, 200);
        var items = await query.OrderBy(x => x.Worker.WorkerNo).ThenBy(x => x.Issue.On)
            .Skip(Math.Max(0, page - 1) * size).Take(size)
            .Select(x => new HistoryIssueDto(x.Issue.Id, x.Worker.Id, x.Worker.WorkerNo, x.Person.NameEn, x.Worker.ProjectName, x.Issue.Code, x.Issue.On, x.Issue.Details, x.Issue.SourceNo))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var state = await db.HistoryImports.AsNoTracking().FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return new HistoryIssueListDto(total, counts, workers, state?.BuiltAt, state?.Summary, items);
    }
}
