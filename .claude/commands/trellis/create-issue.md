# Create GitHub Issue

Create a new GitHub issue using the GitHub CLI (`gh`).

## Usage

```
/trellis:create-issue
```

Then provide the details interactively or via arguments.

## Prerequisites

- GitHub CLI (`gh`) must be installed: `brew install gh`
- Must be authenticated: `gh auth login`

## Execution Steps

### 1. Check Prerequisites

```bash
gh --version
gh auth status
```

If not authenticated, prompt user to run:
```bash
gh auth login
```

### 2. Gather Issue Information

Ask user for:
- **Title** (required): Issue title
- **Body** (optional): Issue description (markdown supported)
- **Labels** (optional): Comma-separated labels
- **Milestone** (optional): Milestone name or number
- **Assignees** (optional): Comma-separated GitHub usernames

### 3. Create Issue via CLI

**Basic creation:**
```bash
gh issue create --title "Issue Title" --body "Issue description"
```

**With optional flags:**
```bash
gh issue create \
  --title "Issue Title" \
  --body "Issue description" \
  --label "bug,urgent" \
  --milestone "v1.0" \
  --assignee "username1,username2"
```

**From file:**
```bash
gh issue create --title "Title" --body-file path/to/description.md
```

### 4. Output Result

On success:
```
[OK] GitHub issue created successfully

URL: https://github.com/owner/repo/issues/123
Number: #123
Title: [issue title]
```

On failure:
```
[ERROR] Failed to create issue

Reason: [error message from gh CLI]

Common fixes:
- Check network connection
- Verify repository permissions
- Ensure gh CLI is authenticated: gh auth login
```

## Examples

### Create a bug report
```bash
gh issue create \
  --title "Bug: Login fails with 500 error" \
  --body "## Description\n\nLogin endpoint returns 500...\n\n## Steps to reproduce\n1. ...\n2. ..." \
  --label "bug"
```

### Create a feature request
```bash
gh issue create \
  --title "Feature: Add dark mode support" \
  --body "### Motivation\n\nUsers have requested...\n\n### Proposed solution\n\nAdd a theme toggle..." \
  --label "enhancement" \
  --assignee "developer1"
```

### Create from a file
```bash
gh issue create --title "Test Issue" --body-file .trellis/issues/test-optimization.md
```

## Additional gh issue Commands

List all issues:
```bash
gh issue list
```

View issue details:
```bash
gh issue view 123
```

Close an issue:
```bash
gh issue close 123
```

Reopen an issue:
```bash
gh issue reopen 123
```

## Notes

- The `gh` CLI automatically detects the repository from the current git remote
- Use `--web` flag to open the issue in browser after creation
- Use `--repo owner/repo` to specify a different repository
