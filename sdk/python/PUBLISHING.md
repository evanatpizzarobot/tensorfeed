# Publishing the tensorfeed Python SDK

Maintainer-only doc. Run from `sdk/python/`.

## One-time setup

1. Create a PyPI account: https://pypi.org/account/register/
2. (Recommended) Create an API token scoped to the `tensorfeed` project:
   https://pypi.org/manage/account/token/
3. Save the token in `~/.pypirc`:
   ```
   [pypi]
   username = __token__
   password = pypi-<your-token>
   ```
   Or pass it inline at upload time.

4. Install the build and upload tools (one-time):
   ```bash
   python -m pip install --upgrade build twine
   ```

## Publishing a new version

1. Bump the version in two places, keeping them in sync:
   - `pyproject.toml` -> `version = "X.Y.Z"`
   - `tensorfeed/__init__.py` -> `__version__ = "X.Y.Z"`

2. Update `README.md` if the public API changed.

3. Clean prior build artifacts (the `.gitignore` keeps them out of the
   repo, but stale dist files can confuse twine):
   ```bash
   rm -rf dist/ build/ tensorfeed.egg-info/
   ```

4. Build the source distribution and wheel:
   ```bash
   python -m build
   ```
   This produces `dist/tensorfeed-X.Y.Z.tar.gz` and
   `dist/tensorfeed-X.Y.Z-py3-none-any.whl`.

5. (Optional but recommended) Test the wheel installs cleanly in a
   throwaway environment:
   ```bash
   python -m venv /tmp/tf-test
   /tmp/tf-test/bin/pip install dist/tensorfeed-*.whl
   /tmp/tf-test/bin/python -c "from tensorfeed import TensorFeed; print(TensorFeed().status())"
   rm -rf /tmp/tf-test
   ```

6. Upload to TestPyPI first (smoke test, free, separate from real PyPI):
   ```bash
   python -m twine upload --repository testpypi dist/*
   ```
   Then verify the listing at https://test.pypi.org/project/tensorfeed/
   and try installing from there:
   ```bash
   pip install --index-url https://test.pypi.org/simple/ tensorfeed
   ```

7. Upload to real PyPI:
   ```bash
   python -m twine upload dist/*
   ```

8. Verify at https://pypi.org/project/tensorfeed/ and install in a fresh
   environment:
   ```bash
   pip install tensorfeed
   ```

9. Tag the release in git:
   ```bash
   git tag -a "py-sdk-vX.Y.Z" -m "Python SDK X.Y.Z"
   git push origin "py-sdk-vX.Y.Z"
   ```

## Versioning policy

- **Patch (X.Y.Z+1):** bug fixes, no API surface changes.
- **Minor (X.Y+1.0):** additive API changes (new methods, new optional
  parameters). Existing code keeps working.
- **Major (X+1.0.0):** breaking changes (renamed methods, removed
  parameters, changed return shapes). Avoid these unless necessary.

## If a release goes wrong

PyPI does not allow re-uploading an existing version. If a release is
broken:
1. Bump the version (e.g., 1.1.0 -> 1.1.1) and re-publish.
2. Optionally yank the broken version on PyPI (does not delete it but
   prevents new installs from picking it up by default).
