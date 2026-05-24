from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    rainbird_host: str = "192.168.1.100"
    rainbird_password: str = ""
    mock_mode: bool = False
    poll_interval: int = 5
    database_url: str = "sqlite:///./rainbird.db"

    model_config = {"env_file": ".env"}


settings = Settings()
