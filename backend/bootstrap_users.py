import getpass

from sqlmodel import Session, select

from auth import hash_password
from database import engine
from models import User


def create_account(
    label: str,
    is_superuser: bool,
):

    print()
    print(f"Create {label}")

    email = input(
        "Email: "
    ).strip().lower()

    display_name = input(
        "Display name: "
    ).strip()

    password = getpass.getpass(
        "Password: "
    )

    confirm_password = (
        getpass.getpass(
            "Confirm password: "
        )
    )

    if password != confirm_password:
        raise ValueError(
            "Passwords do not match."
        )

    if len(password) < 12:
        raise ValueError(
            "Use at least 12 characters."
        )


    with Session(engine) as session:

        existing_user = (
            session.exec(
                select(User).where(
                    User.email == email
                )
            ).first()
        )

        if existing_user:
            print(
                "Account already exists:",
                existing_user.id,
            )
            return existing_user


        user = User(
            email=email,
            display_name=display_name,
            password_hash=
                hash_password(password),
            is_superuser=
                is_superuser,
            is_active=True,
        )

        session.add(user)
        session.commit()
        session.refresh(user)

        print(
            "Created:",
            user.email,
        )

        print(
            "UUID:",
            user.id,
        )

        return user


if __name__ == "__main__":

    print(
        "Budget Tool user bootstrap"
    )

    create_account(
        "SUPERUSER",
        True,
    )

    create_account(
        "SECOND USER",
        False,
    )
    