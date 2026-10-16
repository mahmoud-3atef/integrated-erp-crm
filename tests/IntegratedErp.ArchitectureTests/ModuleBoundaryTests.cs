using IntegratedErp.BuildingBlocks.Modules;
using NetArchTest.Rules;

namespace IntegratedErp.ArchitectureTests;

public sealed class ModuleBoundaryTests
{
    [Fact]
    public void Solution_assemblies_follow_module_dependency_rules()
    {
        var violations = ModuleDependencyRules.FindViolations(SolutionAssemblies.Graph);

        Assert.True(violations.Count == 0, string.Join(Environment.NewLine, violations));
    }

    [Fact]
    public void At_least_one_module_is_discovered_from_the_host()
    {
        Assert.NotEmpty(SolutionAssemblies.ModuleImplementations);
    }

    [Fact]
    public void Each_module_implementation_has_exactly_one_module_entry_point()
    {
        foreach (var assembly in SolutionAssemblies.ModuleImplementations)
        {
            var entryPoints = assembly.GetTypes()
                .Where(t => typeof(IModule).IsAssignableFrom(t) && t is { IsClass: true, IsAbstract: false })
                .ToList();

            Assert.True(entryPoints.Count == 1, $"{assembly.GetName().Name} must have exactly one IModule implementation, found {entryPoints.Count}.");
        }
    }

    [Fact]
    public void Domain_code_does_not_depend_on_infrastructure_frameworks()
    {
        foreach (var assembly in SolutionAssemblies.ModuleImplementations)
        {
            var result = Types.InAssembly(assembly)
                .That().ResideInNamespaceContaining(".Domain")
                .ShouldNot().HaveDependencyOnAny("Microsoft.EntityFrameworkCore", "Microsoft.AspNetCore", "System.Data")
                .GetResult();

            Assert.True(result.IsSuccessful, $"{assembly.GetName().Name}: domain types depend on infrastructure: {string.Join(", ", result.FailingTypeNames ?? [])}");
        }
    }

    [Fact]
    public void Shared_kernel_does_not_depend_on_frameworks()
    {
        var sharedKernel = SolutionAssemblies.All.Single(a => a.GetName().Name == SolutionAssemblies.SharedKernel);

        var result = Types.InAssembly(sharedKernel)
            .ShouldNot().HaveDependencyOnAny("Microsoft.AspNetCore", "Microsoft.EntityFrameworkCore", "Microsoft.Extensions")
            .GetResult();

        Assert.True(result.IsSuccessful, string.Join(", ", result.FailingTypeNames ?? []));
    }
}
