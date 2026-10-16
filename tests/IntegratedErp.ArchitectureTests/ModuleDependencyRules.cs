namespace IntegratedErp.ArchitectureTests;

/// <summary>
/// Dependency rules between solution assemblies (docs/02-target-architecture/14 §2):
/// <list type="bullet">
/// <item>A module implementation may reference other modules' <c>.Contracts</c> only — never their implementation.</item>
/// <item>A <c>.Contracts</c> assembly may reference only the SharedKernel and other contracts.</item>
/// <item>The SharedKernel references no other solution assembly.</item>
/// </list>
/// Kept as a pure function over the reference graph so the rules themselves are unit-tested.
/// </summary>
internal static class ModuleDependencyRules
{
    public static IReadOnlyList<string> FindViolations(IReadOnlyCollection<AssemblyNode> graph)
    {
        var violations = new List<string>();
        var byName = graph.ToDictionary(n => n.Name, StringComparer.Ordinal);

        foreach (var node in graph)
        {
            var solutionReferences = node.References
                .Where(r => r.StartsWith(SolutionAssemblies.RootPrefix, StringComparison.Ordinal))
                .ToList();

            foreach (var reference in solutionReferences)
            {
                var target = byName.TryGetValue(reference, out var known) ? known : new AssemblyNode(reference, []);

                if (node.IsModuleImplementation && target.IsModuleImplementation)
                {
                    violations.Add($"{node.Name} references module implementation {target.Name}; reference {target.Name}.Contracts instead.");
                }

                if (node.IsModuleContracts && !(target.IsModuleContracts || target.Name == SolutionAssemblies.SharedKernel))
                {
                    violations.Add($"{node.Name} (contracts) may reference only SharedKernel or other contracts, but references {target.Name}.");
                }

                if (node.Name == SolutionAssemblies.SharedKernel)
                {
                    violations.Add($"SharedKernel must not reference solution assembly {target.Name}.");
                }
            }
        }

        return violations;
    }
}
