namespace IntegratedErp.ArchitectureTests;

/// <summary>Proves the boundary rules actually catch violations (not only that today's code passes).</summary>
public sealed class ModuleDependencyRulesTests
{
    private static AssemblyNode Node(string name, params string[] references) => new(name, references);

    [Fact]
    public void Module_referencing_another_module_contracts_is_allowed()
    {
        var graph = new[]
        {
            Node("IntegratedErp.SharedKernel"),
            Node("IntegratedErp.Modules.Billing.Contracts", "IntegratedErp.SharedKernel"),
            Node("IntegratedErp.Modules.Payroll", "IntegratedErp.Modules.Billing.Contracts", "IntegratedErp.BuildingBlocks"),
        };

        Assert.Empty(ModuleDependencyRules.FindViolations(graph));
    }

    [Fact]
    public void Module_referencing_another_module_implementation_is_a_violation()
    {
        var graph = new[]
        {
            Node("IntegratedErp.Modules.Billing"),
            Node("IntegratedErp.Modules.Payroll", "IntegratedErp.Modules.Billing"),
        };

        var violation = Assert.Single(ModuleDependencyRules.FindViolations(graph));
        Assert.Contains("IntegratedErp.Modules.Billing.Contracts instead", violation, StringComparison.Ordinal);
    }

    [Fact]
    public void Contracts_referencing_building_blocks_is_a_violation()
    {
        var graph = new[]
        {
            Node("IntegratedErp.BuildingBlocks"),
            Node("IntegratedErp.Modules.Billing.Contracts", "IntegratedErp.BuildingBlocks"),
        };

        Assert.Single(ModuleDependencyRules.FindViolations(graph));
    }

    [Fact]
    public void Shared_kernel_referencing_any_solution_assembly_is_a_violation()
    {
        var graph = new[]
        {
            Node("IntegratedErp.BuildingBlocks"),
            Node("IntegratedErp.SharedKernel", "IntegratedErp.BuildingBlocks"),
        };

        Assert.Single(ModuleDependencyRules.FindViolations(graph));
    }
}
