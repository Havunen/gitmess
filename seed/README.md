# seed

Fixtures for verifying GitComet Pro's forge views against this repository.
Every `verify/*` branch starts from `main` and exists to become one kind of
pull request:

| Branch                 | Pull request it becomes                           |
|------------------------|---------------------------------------------------|
| `verify/clean`         | merges cleanly                                    |
| `verify/conflict`      | conflicts with `main` in `seed/shared.txt`        |
| `verify/draft`         | opened as a draft                                 |
| `verify/stack-1..3`    | a stack, each based on the one before             |
| `verify/wide`          | 350 files, so the file list paginates             |
| `verify/rename-binary` | two renames and a binary file                     |
| `verify/merged`        | merged and then reverted                          |

`.github/workflows/verify.yml` produces passing, failing, slow, annotated,
large-log and large-artifact runs.
