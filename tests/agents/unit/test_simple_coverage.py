"""Simple test to improve coverage."""


def test_agents_module_import():
    """Test that agents module can be imported."""
    # This will cover the agents/__init__.py file
    import agents

    # Access the __version__ to ensure it's loaded
    assert hasattr(agents, "__version__")
