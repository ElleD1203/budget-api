from sqlalchemy import text
from database import engine, get_session
from models import Transaction
from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from pathlib import Path
from pydantic import BaseModel
from openpyxl import load_workbook, Workbook
from datetime import datetime, date as date_type
from io import BytesIO
from fastapi.responses import StreamingResponse
from sqlmodel import SQLModel, Field, Session, select
import uuid
import traceback 




app = FastAPI(title="Budget Tool API")

app.add_middleware(
    CORSMiddleware,
       allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# USERS
# =========================================================

USERS = [
    {
        "id": 1,
        "name": "User 1",
    },
    {
        "id": 2,
        "name": "User 2",
    },

    # Future users:
    # {
    #     "id": 3,
    #     "name": "User 3",
    # },
    # {
    #     "id": 4,
    #     "name": "User 4",
    # },
]

SQLModel.metadata.create_all(engine)

# =========================================================
# EXISTING DATA MIGRATION
# =========================================================

# Your old transactions probably do not have user_id.
# For now, assign all old transactions to User 1.



BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


class TransactionCreate(BaseModel):
    user_id: int
    date: str
    merchant: str 
    amount: float

    

class TransactionUpdate(BaseModel):
    date: str | None = None
    merchant: str | None = None
    amount: float | None = None

class BulkDeleteRequest(BaseModel):
    user_id: int
    ids: list[uuid.UUID]

class ExportTransactionsRequest(BaseModel):
    user_id: int
    ids: list[uuid.UUID]



def validate_user(user_id: int):
    for user in USERS:
        if user["id"] == user_id:
            return user

    raise HTTPException(
        status_code=404,
        detail="User not found",
    )


def get_transaction_type(amount: float):
    if amount > 0:
        return "income"
    elif amount < 0:
        return "expense"
    else:
        return "zero"


def clean_date(value):
    """
    convert excel date values into yyyy-mm-dd text.
    """
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    
    if isinstance(value, date_type):
        return value.strftime("%Y-%m-%d")
    
    return str(value).strip()

def clean_amount(value):
    """
    convert excel amount value into a number
    """

    try:
        return float(value)
    except:
        raise HTTPException(
            status_code=400,
            detail=f"invalid amount value:{value}"
        )

# =========================================================
# USERS
# =========================================================

@app.get("/api/v1/users")
def get_users():
    return USERS



@app.get("/api/health")
def health_check():
    return {"status": "healthy"}




# =========================================================
# GET TRANSACTIONS FOR ONE USER
# =========================================================

@app.get("/api/v1/transactions")
def get_transactions(
    user_id: int,
    session: Session = Depends(get_session),
):

    validate_user(user_id)

    statement = (
        select(Transaction)
        .where(
            Transaction.user_id == user_id
        )
        .order_by(
            Transaction.date.desc()
        )
    )

    results = session.exec(
        statement
    ).all()

    return results

# =========================================================
# CREATE ONE TRANSACTION
# =========================================================

@app.post("/api/v1/transactions")
def create_transaction(
    transaction: TransactionCreate,
    session: Session = Depends(get_session),
):

    validate_user(
        transaction.user_id
    )

    db_transaction = Transaction(
        user_id=
            transaction.user_id,
        date=
            transaction.date,
        merchant=
            transaction.merchant,
        amount=
            transaction.amount,
        transaction_type=
            get_transaction_type(
                transaction.amount
            ),
    )

    session.add(
        db_transaction
    )

    session.commit()

    session.refresh(
        db_transaction
    )

    return db_transaction

# =========================================================
# UPLOAD EXCEL
# =========================================================

@app.post("/api/v1/transactions/upload-excel")
def upload_excel(
    user_id: int = Form(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):

    validate_user(user_id)

    filename = file.filename or ""

    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail="Only .xlsx Excel files are supported",
        )

    try:
        workbook = load_workbook(
            file.file,
            data_only=True,
        )

        sheet = workbook.active

        headers = []

        for cell in sheet[1]:
            if cell.value is None:
                headers.append("")
            else:
                headers.append(
                    str(cell.value)
                    .strip()
                    .lower()
                )

        required_columns = [
            "date",
            "merchant",
            "amount",
        ]

        for column in required_columns:
            if column not in headers:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required column: {column}",
                )

        date_index = headers.index("date")
        merchant_index = headers.index("merchant")
        amount_index = headers.index("amount")

        new_database_transactions = []

        for row in sheet.iter_rows(
            min_row=2,
            values_only=True,
        ):

            row_date = row[date_index]
            row_merchant = row[merchant_index]
            row_amount = row[amount_index]

            # Skip completely empty rows
            if (
                row_date is None
                and row_merchant is None
                and row_amount is None
            ):
                continue

            if (
                row_date is None
                or row_merchant is None
                or row_amount is None
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Each row must have date, "
                        "merchant, and amount"
                    ),
                )

            amount = clean_amount(
                row_amount
            )

            db_transaction = Transaction(
                user_id=user_id,
                date=clean_date(row_date),
                merchant=str(
                    row_merchant
                ).strip(),
                amount=amount,
                transaction_type=
                    get_transaction_type(amount),
            )

            session.add(
                db_transaction
            )

            new_database_transactions.append(
                db_transaction
            )

        # This actually writes the rows
        # permanently to PostgreSQL
        session.commit()

        # Retrieve generated IDs
        for transaction in new_database_transactions:
            session.refresh(transaction)

        return {
            "message":
                "Excel file uploaded successfully",
            "user_id":
                user_id,
            "rows_added":
                len(new_database_transactions),
            "transactions_added": [
                {
                    "id":
                        transaction.id,
                    "user_id":
                        transaction.user_id,
                    "date":
                        transaction.date,
                    "merchant":
                        transaction.merchant,
                    "amount":
                        transaction.amount,
                    "transaction_type":
                        transaction.transaction_type,
                }
                for transaction
                in new_database_transactions
            ],
        }

    except HTTPException:
        session.rollback()
        raise

    except Exception as error:
        session.rollback()

        print("\n==============================")
        print("EXCEL UPLOAD ERROR")
        print("==============================")

        print("ERROR TYPE:")
        print(type(error).__name__)

        print("ERROR MESSAGE:")
        print(str(error))

        print("FULL ERROR:")
        print(repr(error))

        print("==============================\n")

        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# =========================================================
# BULK DELETE
#
# Keep this ABOVE /{transaction_id}
# =========================================================

@app.delete(
    "/api/v1/transactions/bulk-delete"
)
def bulk_delete_transactions(
    request: BulkDeleteRequest,
    session: Session = Depends(get_session),
):
    validate_user(request.user_id)

    if len(request.ids) == 0:
        raise HTTPException(
            status_code=400,
            detail="No transaction IDs were provided",
        )

    requested_ids = set(request.ids)

    # Get this user's transactions
    statement = select(Transaction).where(
        Transaction.user_id == request.user_id,
        Transaction.id.in_(request.ids),
    )

    user_transactions = session.exec(
        statement
    ).all()

    transactions_to_delete = [
        transaction
        for transaction in user_transactions
        if transaction.id in requested_ids
    ]

    deleted_ids = [
        transaction.id
        for transaction in transactions_to_delete
    ]

    for transaction in transactions_to_delete:
        session.delete(transaction)

    session.commit()

    not_found_ids = [
        transaction_id
        for transaction_id in request.ids
        if transaction_id not in deleted_ids
    ]

    return {
        "message":
            "Group delete completed",

        "user_id":
            request.user_id,

        "deleted_ids":
            deleted_ids,

        "not_found_ids":
            not_found_ids,

        "deleted_count":
            len(deleted_ids),
    }

# =========================================================
# EXPORT SELECTED TRANSACTIONS
# =========================================================

@app.post(
    "/api/v1/transactions/export-excel"
)
def export_transactions_to_excel(
    request: ExportTransactionsRequest,
    session: Session = Depends(get_session),
):
    validate_user(request.user_id)

    if len(request.ids) == 0:
        raise HTTPException(
            status_code=400,
            detail="No transactions were selected",
        )

    # Read this user's transactions from PostgreSQL
    statement = select(Transaction).where(
        Transaction.user_id == request.user_id
    )

    user_transactions = session.exec(
        statement
    ).all()

    # Create dictionary:
    # transaction ID -> Transaction object
    transaction_lookup = {
        transaction.id: transaction
        for transaction in user_transactions
    }

    # Preserve the order sent by React
    selected_transactions = [
        transaction_lookup[transaction_id]
        for transaction_id in request.ids
        if transaction_id in transaction_lookup
    ]

    if len(selected_transactions) == 0:
        raise HTTPException(
            status_code=404,
            detail=(
                "No matching transactions "
                "were found for this user"
            ),
        )

    workbook = Workbook()

    worksheet = workbook.active
    worksheet.title = "Transactions"

    # Headers
    worksheet.append([
        "ID",
        "User ID",
        "Date",
        "Merchant",
        "Amount",
        "Transaction Type",
    ])

    # Data
    for transaction in selected_transactions:
        worksheet.append([
            str(transaction.id),
            transaction.user_id,
            transaction.date,
            transaction.merchant,
            transaction.amount,
            transaction.transaction_type,
        ])

    # Optional: make columns easier to read
    worksheet.column_dimensions["A"].width = 12
    worksheet.column_dimensions["B"].width = 12
    worksheet.column_dimensions["C"].width = 15
    worksheet.column_dimensions["D"].width = 25
    worksheet.column_dimensions["E"].width = 15
    worksheet.column_dimensions["F"].width = 20

    excel_file = BytesIO()

    workbook.save(excel_file)

    excel_file.seek(0)

    return StreamingResponse(
        excel_file,
        media_type=(
            "application/vnd.openxmlformats-"
            "officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition":
                'attachment; '
                'filename="budget_transactions.xlsx"'
        },
    )

# =========================================================
# SINGLE DELETE
# =========================================================

@app.delete(
    "/api/v1/transactions/{transaction_id}"
)
def delete_transaction(
    transaction_id: uuid.UUID,
    user_id: int,
    session: Session = Depends(get_session),
):
    validate_user(user_id)

    transaction = session.get(
        Transaction,
        transaction_id,
    )

    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    # Prevent one user from deleting
    # another user's transaction
    if transaction.user_id != user_id:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found for this user",
        )

    session.delete(transaction)
    session.commit()

    return {
        "message":
            "Transaction deleted successfully",
        "deleted_id":
            transaction_id,
        "user_id":
            user_id,
    }

# =========================================================
# SUMMARY BY USER
# =========================================================



# =========================================================
# add a test endpoint
# =========================================================

@app.get("/api/v1/db-health")
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(
                text("SELECT 1")
            )

        return {
            "status": "connected",
            "database": "budget_db",
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health")
def health_check():

    return {
        "status": "healthy"
    }

