from app.services.report_service import extract_pyproject_toml, extract_setup_py, extract_pipfile

# Test pyproject.toml
toml_content = """
[project]
name = "medimatch"
version = "0.1.0"
dependencies = [
    "fastapi>=0.100.0",
    "uvicorn[standard]",
    "sqlalchemy==2.0.0",
    "python-jose[cryptography]",
]

[tool.poetry.dependencies]
python = "^3.9"
fastapi = "^0.100.0"
sqlalchemy = "^2.0.0"
"""
print('pyproject.toml deps:', extract_pyproject_toml(toml_content))

# Test setup.py
setup_content = """
from setuptools import setup
setup(
    name="medimatch",
    install_requires=[
        "fastapi>=0.100.0",
        "uvicorn[standard]",
        "sqlalchemy==2.0.0",
    ],
)
"""
print('setup.py deps:', extract_setup_py(setup_content))

# Test Pipfile
pipfile_content = """
[[source]]
url = "https://pypi.org/simple"
verify_ssl = true

[packages]
fastapi = "*==0.100.0"
sqlalchemy = "*>=2.0.0"

[dev-packages]
pytest = "*>=7.0"
"""
print('Pipfile deps:', extract_pipfile(pipfile_content))
