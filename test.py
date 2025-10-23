# registry.py
from typing import Dict, Type, Callable, List

# Global registries
WORKFLOW_REGISTRY: Dict[str, Type] = {}
ACTIVITY_REGISTRY: Dict[str, Callable] = {}


def register_workflow(name: str, activities: List[str]):
    """
    Decorator to register workflows.
    Each workflow must declare the activities it uses.
    """
    def decorator(cls):
        if name in WORKFLOW_REGISTRY:
            raise ValueError(f"Workflow '{name}' is already registered.")
        cls._workflow_name = name
        cls._activities = activities
        WORKFLOW_REGISTRY[name] = cls
        return cls
    return decorator


def register_activity(name: str = None):
    """
    Decorator to register activities.
    """
    def decorator(func):
        nonlocal name
        name = name or func.__name__
        if name in ACTIVITY_REGISTRY:
            raise ValueError(f"Activity '{name}' is already registered.")
        ACTIVITY_REGISTRY[name] = func
        return func
    return decorator


# loader.py
import importlib
import pkgutil
import os
import yaml
from pathlib import Path


def discover_modules(package_name: str):
    """
    Dynamically import all modules from a given package.
    Ensures all decorators are executed and registries populated.
    """
    package = importlib.import_module(package_name)
    package_path = os.path.dirname(package.__file__)

    for _, modname, ispkg in pkgutil.iter_modules([package_path]):
        if not ispkg:
            importlib.import_module(f"{package_name}.{modname}")


def load_config(config_path: str) -> dict:
    """
    Load YAML configuration file that defines workflows to register.
    """
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with open(path, "r") as f:
        return yaml.safe_load(f)

# main.py

import os
import sys
from temporalio import worker
from registry.loader import discover_modules, load_config
from registry.registry import WORKFLOW_REGISTRY, ACTIVITY_REGISTRY


def main():
    # 1. Discover activities and workflows
    discover_modules("activities")
    discover_modules("workflows")

    # 2. Load config from ENV or default path
    config_path = os.getenv("WORKFLOW_CONFIG_PATH", "registry/config.yaml")
    config = load_config(config_path)
    workflows_config = config.get("workflows", [])

    if not workflows_config:
        print("❌ No workflows defined in YAML config.")
        sys.exit(1)

    # 3. Validate workflows and their declared activities
    for wf_def in workflows_config:
        wf_name = wf_def.get("name")
        task_queue = wf_def.get("task_queue")

        if not wf_name or not task_queue:
            print(f"❌ Invalid workflow config: {wf_def}")
            sys.exit(1)

        wf_class = WORKFLOW_REGISTRY.get(wf_name)
        if not wf_class:
            print(f"❌ Workflow '{wf_name}' not found in internal registry.")
            sys.exit(1)

        # Validate that all referenced activities exist
        required_activities = getattr(wf_class, "_activities", [])
        missing_activities = [
            act for act in required_activities if act not in ACTIVITY_REGISTRY
        ]
        if missing_activities:
            print(
                f"❌ Workflow '{wf_name}' refers to missing activities: {missing_activities}"
            )
            sys.exit(1)

        print(f"✅ Registering workflow '{wf_name}' on task queue '{task_queue}'")
        print(f"   → Activities: {', '.join(required_activities) or 'None'}")

        # Create the Temporal Worker (client=None placeholder)
        worker_instance = worker.Worker(
            client=None,
            task_queue=task_queue,
            workflows=[wf_class],
            activities=[ACTIVITY_REGISTRY[a] for a in required_activities],
        )
        # worker_instance.run()  # Uncomment in real deployment

    print("✅ All workflows and activities validated successfully.")


if __name__ == "__main__":
    main()
