# GitHub Workflow Setup

This repository now includes a GitHub workflow that automatically builds, tests, and publishes the package to npm when you push to the main branch.

## Workflow Features

- **Testing**: Runs on Node.js 18 and 20 to ensure compatibility
- **Type checking**: Validates TypeScript types
- **Linting**: Runs ESLint to catch code issues
- **Building**: Compiles the package using Vite
- **Publishing**: Automatically publishes to npm when version changes
- **Releases**: Creates GitHub releases with version tags

## Setup Instructions

### 1. NPM Token Setup

To enable automatic publishing, you need to add your npm token as a GitHub secret:

1. Go to [npmjs.com](https://www.npmjs.com) and log in
2. Click on your profile picture → "Access Tokens"
3. Click "Generate New Token" → "Classic Token"
4. Choose "Automation" scope (for CI/CD)
5. Copy the generated token
6. In your GitHub repository, go to Settings → Secrets and variables → Actions
7. Click "New repository secret"
8. Name: `NPM_TOKEN`
9. Value: Paste your npm token
10. Click "Add secret"

### 2. Package Publishing

The workflow will only publish when:

- You push to the `main` branch
- The version in `package.json` has changed from what's published on npm

To publish a new version:

1. Update the version in `package.json`:
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```
2. Commit and push to main:
   ```bash
   git add package.json
   git commit -m "bump version to x.x.x"
   git push origin main
   ```

The workflow will automatically:

- Run all tests
- Build the package
- Publish to npm
- Create a GitHub release

### 3. Workflow Status

You can monitor the workflow progress in the "Actions" tab of your GitHub repository. Each push will trigger the workflow, and you'll see the status of each job.

## Troubleshooting

- **npm publish fails**: Check that your `NPM_TOKEN` secret is correctly set
- **Tests fail**: The workflow won't publish if any tests fail
- **Build fails**: Ensure all TypeScript types are correct and the build succeeds locally
- **Version not changed**: The workflow skips publishing if the version in package.json matches what's already published

## Manual Testing

You can test the workflow locally by running:

```bash
npm ci
npm run type-check
npm run lint
npm test
npm run build
```

All of these commands should succeed before pushing to main.
