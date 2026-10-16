using System.Reflection;

namespace IntegratedErp.ArchitectureTests;

/// <summary>A solution assembly and the solution assemblies it references.</summary>
internal sealed record AssemblyNode(string Name, IReadOnlyCollection<string> References)
{
    public bool IsModuleContracts => Name.StartsWith(SolutionAssemblies.ModulePrefix, StringComparison.Ordinal)
        && Name.EndsWith(".Contracts", StringComparison.Ordinal);

    public bool IsModuleImplementation => Name.StartsWith(SolutionAssemblies.ModulePrefix, StringComparison.Ordinal)
        && !IsModuleContracts;
}

/// <summary>Loads every IntegratedErp assembly reachable from the API host.</summary>
internal static class SolutionAssemblies
{
    public const string RootPrefix = "IntegratedErp.";
    public const string ModulePrefix = "IntegratedErp.Modules.";
    public const string SharedKernel = "IntegratedErp.SharedKernel";
    public const string BuildingBlocks = "IntegratedErp.BuildingBlocks";

    private static readonly Lazy<IReadOnlyList<Assembly>> Loaded = new(LoadAll);

    public static IReadOnlyList<Assembly> All => Loaded.Value;

    public static IReadOnlyList<AssemblyNode> Graph => All
        .Select(a => new AssemblyNode(
            a.GetName().Name!,
            a.GetReferencedAssemblies().Select(r => r.Name!).ToList()))
        .ToList();

    public static IEnumerable<Assembly> ModuleImplementations => All.Where(a =>
        new AssemblyNode(a.GetName().Name!, []).IsModuleImplementation);

    // Every solution assembly copied next to the tests (the test project references the API host,
    // which references all modules). Loading from disk also finds assemblies that nothing uses yet,
    // whose references the compiler would otherwise drop from metadata.
    private static List<Assembly> LoadAll()
    {
        var testAssembly = typeof(SolutionAssemblies).Assembly.GetName().Name;

        return Directory.EnumerateFiles(AppContext.BaseDirectory, RootPrefix + "*.dll")
            .Select(path => AssemblyName.GetAssemblyName(path))
            .Where(name => name.Name != testAssembly)
            .Select(Assembly.Load)
            .ToList();
    }
}
