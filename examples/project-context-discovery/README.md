# Project Context Discovery Example

This directory is the smallest repository fixture used to validate issue `#298`.

It intentionally contains only:

- `actant.namespace.json`
- one knowledge entry file
- one skill
- one prompt
- one template

A backend should be able to discover all of them through the project-context loader and
through `/project/context.json` without oral help.
