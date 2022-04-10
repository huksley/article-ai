"""Web app entry point, when running as python -m app"""
from . import get_app

app = get_app()

if __name__ == "__main__":
    app.run(port=8088)
