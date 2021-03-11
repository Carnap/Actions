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
          defaultVisibility: 'private'
          # files to include in the upload (important: this must be quoted)
          includeFiles: '["*.md"]'
          instanceUrl: 'https://carnap.io'

```

Then, you can push some markdown to the repo to test everything works and
shows up on your Carnap account.