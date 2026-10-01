from logging.config import fileConfig

from alembic import context
from sqlmodel import SQLModel

from database import engine
from models import Transaction, User 


# Alembic configuration
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Importing Transaction registers the existing
# transactions table with SQLModel.metadata.

target_metadata = SQLModel.metadata


def run_migrations_offline():
    """
    Generate migration SQL without directly
    connecting to the database.
    """

    url = engine.url.render_as_string(
        hide_password=False
    )

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """
    Connect to PostgreSQL and apply migrations.
    """

    with engine.connect() as connection:

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()