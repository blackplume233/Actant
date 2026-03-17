# Project Context Bootstrap Fixture

This fixture exists to validate the minimum project-context bootstrap loop.

An agent entering this directory should be able to determine:

- the project is a minimal bootstrap validation fixture
- it should read `actant.project.json` and then this file
- the available reusable assets live under `configs/`

The expected discovery order is:

1. `/project/context.json`
2. `actant.project.json`
3. `PROJECT_CONTEXT.md`
