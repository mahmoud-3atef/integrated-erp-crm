using IntegratedErp.BuildingBlocks.Modules;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.UnitTests.BuildingBlocks;

public sealed class ModuleRegistryTests
{
    private sealed class FakeModule(string name) : IModule
    {
        public string Name { get; } = name;

        public bool Registered { get; private set; }

        public void RegisterServices(IServiceCollection services, IConfiguration configuration) => Registered = true;

        public void MapEndpoints(IEndpointRouteBuilder endpoints)
        {
        }
    }

    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value)))
            .Build();

    [Fact]
    public void Modules_are_enabled_by_default()
    {
        var registry = new ModuleRegistry([new FakeModule("Billing")], Config());

        Assert.True(Assert.Single(registry.Describe()).Enabled);
    }

    [Fact]
    public void Disabled_module_is_not_registered()
    {
        var finance = new FakeModule("Finance");
        var billing = new FakeModule("Billing");
        var configuration = Config(("Modules:Finance:Enabled", "false"));

        new ServiceCollection().AddModules(configuration, finance, billing);

        Assert.False(finance.Registered);
        Assert.True(billing.Registered);
    }

    [Fact]
    public void Duplicate_module_names_are_rejected()
    {
        Assert.Throws<InvalidOperationException>(() =>
            new ModuleRegistry([new FakeModule("Billing"), new FakeModule("billing")], Config()));
    }
}
