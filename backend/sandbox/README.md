# AgentGuard Sandbox

This directory contains files that agents can read using the `read_file` tool.

## Available Files

- `README.md` - This file
- `data/sample.txt` - Sample data file with transaction info
- `notes/research.txt` - Research notes sample

## Security

All file reads are restricted to the `sandbox/` directory.
Path traversal attempts are blocked.
