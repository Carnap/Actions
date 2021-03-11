<p align="center">
  <a href="https://github.com/Carnap/Actions/actions"><img alt="Carnap actions status" src="https://github.com/Carnap/Actions/workflows/build-test/badge.svg"></a>
</p>

# Carnap Upload GitHub Action

This GitHub Action uses the new Carnap API to upload documents such as
textbooks.

## Usage

Go to Carnap and obtain your API key from the instructor page on the "Manage
Uploaded Documents" tab of the instructor homepage.

[Add this API key as a secret to your GitHub repository settings](https://docs.github.com/en/actions/reference/encrypted-secrets#creating-encrypted-secrets-for-a-repository)
under the name `CARNAP_API_KEY`.

Create a file called `.github/workflows/ci.yaml` (or some other name) with
the contents:

```yaml
name: 'Deploy markdown files to Carnap'
on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy
        uses: carnap/actions@v1
        with:
          apiKey: '${{ secrets.CARNAP_API_KEY }}'
          # make any newly created documents private
          defaultVisibility: 'Private'
          # files to include in the upload (important: this must be quoted)
          includeFiles: '["*.md"]'
          instanceUrl: 'https://carnap.io'

```

Then, you can push some markdown to the repo to test everything works and
shows up on your Carnap account.

## Command line interface

This repository also provides the `carnap` command line interface that does
the same thing as the GitHub Action. If you want to use it, it's available
via npm. You should need at least node 12.

First, add the GitHub npm registry for the `@carnap` namespace:

```
$ echo '@carnap:registry=https://npm.pkg.github.com' >> $HOME/.npmrc
```

Then you can use the Carnap CLI as follows (no install 🙂):

```
$ npx @carnap/actions upload --help
CARNAP_API_KEY=... carnap upload -b <basepath> -i '<includeFilesJsonList>' [options]

Options:
      --help               Show help                                   [boolean]
      --version            Show version number                         [boolean]
  -b, --basePath           base path to the files to upload  [string] [required]
  -i, --includeFiles       JSON list of globs matching files to include
                                                             [string] [required]
      --url                URL to the Carnap instance to upload to
                                         [string] [default: "https://carnap.io"]
      --defaultVisibility  Default visibility of newly created documents.
         [choices: "Public", "InstructorsOnly", "LinkOnly", "Private"] [default:
                                                                      "Private"]
```

## Troubleshooting

The Carnap action has debug logging that may provide useful information to
diagnose issues.
[Enable it by setting a secret on the repository called `ACTIONS_STEP_DEBUG` with a value of `true`](https://docs.github.com/en/actions/managing-workflow-runs/enabling-debug-logging).
