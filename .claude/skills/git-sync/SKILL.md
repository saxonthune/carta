# /git-sync - Sync claude branch with trunk

**Purpose**: Synchronizes a `<branchname>_claude<N>` branch with its trunk branch `<branchname>`.

**User-invocable**: Yes

## When to use

Use this when you're working on a `<branchname>_claude<N>` branch and want to:
- Sync the trunk branch with latest from origin
- Rebase your claude work on top of the updated trunk
- Merge your changes back into the trunk

## Workflow

1. **Validate branch name**: Check current branch matches pattern `<branchname>_claude<N>` where N is a small natural number
2. **Extract trunk name**: Get `<branchname>` from the current branch name
3. **Fetch from origin**: `git fetch origin`
4. **Update trunk**: Checkout `<branchname>` and pull from `origin/<branchname>`
5. **Rebase claude branch**: Checkout `<branchname>_claude<N>` and rebase onto updated `<branchname>`
6. **Merge into trunk**: Checkout `<branchname>` and merge `<branchname>_claude<N>`
7. **Return to claude branch**: Checkout `<branchname>_claude<N>` again

## Error handling

- If branch name doesn't match pattern, inform user and stop
- If trunk branch doesn't exist locally, inform user
- If `origin/<branchname>` doesn't exist, inform user
- Handle merge conflicts by stopping and informing user

## Implementation

Execute these steps in order:

```bash
# 1. Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# 2. Validate pattern: <branchname>_claude<N>
if [[ ! $CURRENT_BRANCH =~ ^(.+)_claude([0-9]+)$ ]]; then
  echo "Error: Current branch '$CURRENT_BRANCH' doesn't match pattern '<branchname>_claude<N>'"
  exit 1
fi

# 3. Extract trunk name
TRUNK_BRANCH="${BASH_REMATCH[1]}"
CLAUDE_NUMBER="${BASH_REMATCH[2]}"

echo "Claude branch: $CURRENT_BRANCH"
echo "Trunk branch: $TRUNK_BRANCH"

# 4. Fetch from origin
git fetch origin

# 5. Check trunk branch exists locally
if ! git show-ref --verify --quiet "refs/heads/$TRUNK_BRANCH"; then
  echo "Error: Local branch '$TRUNK_BRANCH' doesn't exist"
  exit 1
fi

# 6. Check origin trunk exists
if ! git show-ref --verify --quiet "refs/remotes/origin/$TRUNK_BRANCH"; then
  echo "Error: Remote branch 'origin/$TRUNK_BRANCH' doesn't exist"
  exit 1
fi

# 7. Update trunk from origin
git checkout "$TRUNK_BRANCH"
git pull origin "$TRUNK_BRANCH"

# 8. Rebase claude branch onto updated trunk
git checkout "$CURRENT_BRANCH"
git rebase "$TRUNK_BRANCH"

# 9. Merge claude branch into trunk
git checkout "$TRUNK_BRANCH"
git merge "$CURRENT_BRANCH"

# 10. Return to claude branch
git checkout "$CURRENT_BRANCH"

echo "✓ Sync complete"
```
