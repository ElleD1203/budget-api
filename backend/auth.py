import os
import uuid

from datetime import datetime, timedelta, timezone

import jwt

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from sqlmodel import Session

from database import get_session
from models import User


password_hasher = PasswordHash.recommended()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)

JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY"
)

JWT_ALGORITHM = os.getenv(
    "JWT_ALGORITHM",
    "HS256",
)

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "60",
    )
)


if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not configured."
    )


def hash_password(
    password: str
) -> str:
    return password_hasher.hash(
        password
    )


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    return password_hasher.verify(
        plain_password,
        hashed_password,
    )


def create_access_token(
    user_id: uuid.UUID
) -> str:

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=
            ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    payload = {
        "sub": str(user_id),
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    token: str = Depends(
        oauth2_scheme
    ),
    session: Session = Depends(
        get_session
    ),
) -> User:

    credentials_error = HTTPException(
        status_code=
        status.HTTP_401_UNAUTHORIZED,
        detail=
        "Could not validate credentials",
        headers={
            "WWW-Authenticate":
            "Bearer"
        },
    )

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[
                JWT_ALGORITHM
            ],
        )

        subject = payload.get("sub")

        if subject is None:
            raise credentials_error

        user_id = uuid.UUID(subject)

    except (
        InvalidTokenError,
        ValueError,
    ):
        raise credentials_error


    user = session.get(
        User,
        user_id
    )

    if user is None:
        raise credentials_error

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail=
            "User account is inactive",
        )

    return user


def require_superuser(
    current_user: User = Depends(
        get_current_user
    ),
) -> User:

    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail=
            "Superuser access required",
        )

    return current_user