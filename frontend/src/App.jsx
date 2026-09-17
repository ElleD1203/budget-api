import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const USERS = [
  {
    id: 1,
    name: "User 1",
  },
  {
    id: 2,
    name: "User 2",
  },

  // Future users:
  // {
  //   id: 3,
  //   name: "User 3",
  // },
  // {
  //   id: 4,
  //   name: "User 4",
  // },
];



export default function App() {
  const [currentUserId, setCurrentUserId] = useState(1);
  
  const [showTransactionForm, setShowTransactionForm] =
    useState(false);

  const [showTransactions, setShowTransactions] =
    useState(false);
  
  const [filterApplied, setFilterApplied] = useState(false);

  const [transactions, setTransactions] = useState([]);

  const [selectedIds, setSelectedIds] = useState([]);

  const [filters, setFilters] = useState({
    merchant: "",
    startDate: "",
    endDate: "",
    transactionType: "all",
  });

  const [sortField, setSortField] = useState("date");

  const [sortDirection, setSortDirection] =
    useState("desc");

  const [transaction, setTransaction] = useState({
    date: "",
    merchant: "",
    amount: "",
  });

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef(null);

  const currentUser =
    USERS.find((user) => user.id === currentUserId) || USERS[0];

  // --------------------------------
  // Update add-transaction form
  // --------------------------------

  function updateTransactionField(event) {
    const { name, value } = event.target;

    setTransaction((currentTransaction) => ({
      ...currentTransaction,
      [name]: value,
    }));
  }

  // --------------------------------
  // add filter
  // --------------------------------
  function updateFilter(event) {
    const { name, value } =
      event.target;

    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));

    // User changed search criteria.
    // Require Apply Filter again.
  
    setFilterApplied(false);
    setSelectedIds([]);
  }

  function resetFilters() {
    setFilters({
      merchant: "",
      startDate: "",
      endDate: "",
      transactionType: "all",
  });

    setSortField("date");
    setSortDirection("desc");
    setSelectedIds([]);

    // Hide transaction results again
    setFilterApplied(false);

    setMessage("");

  }

  // --------------------------------
  // profile-switching
  // --------------------------------
  function changeUser(event) {
  const newUserId = Number(event.target.value);

  setCurrentUserId(newUserId);

  // Clear user-specific screen state
  setSelectedIds([]);
  setShowTransactions(false);
  setShowTransactionForm(false);

  setMessage(
    `Switched to ${
      USERS.find((user) => user.id === newUserId)?.name
    }.`
  );
}

  // --------------------------------
  // Read FastAPI error
  // --------------------------------

  async function readErrorMessage(response) {
    try {
      const errorData = await response.json();

      if (typeof errorData.detail === "string") {
        return errorData.detail;
      }

      return (
        errorData.message ||
        `Request failed: ${response.status}`
      );
    } catch {
      return `Request failed: ${response.status}`;
    }
  }

  // --------------------------------
  // GET transactions
  // --------------------------------

  async function loadTransactions(
    userId = currentUserId
  ) {
    try {
      setIsLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/v1/transactions?user_id=${userId}`
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response)
        );
      }

      const data = await response.json();

      console.log(
        "Transactions returned for user:",
        currentUserId,
        data
      );
    
      setTransactions(data);

    } catch (error) {
      setMessage(
        `Unable to load transactions: ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  }

  // --------------------------------
  // POST one transaction
  // --------------------------------

  async function submitTransaction(event) {
    event.preventDefault();

    setMessage("");

    const amount = Number(transaction.amount);

    if (
      !transaction.date ||
      !transaction.merchant.trim() ||
      Number.isNaN(amount)
    ) {
      setMessage(
        "Please enter a valid date, merchant, and amount."
      );

      return;
    }

    try {
      setIsLoading(true);

      console.log("POST transaction body:", {
        user_id: currentUserId,
        date: transaction.date,
        merchant: transaction.merchant,
        amount: Number(transaction.amount),
      });

      const response = await fetch(
        `${API_URL}/api/v1/transactions`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            user_id: currentUserId,
            date: transaction.date,
            merchant: transaction.merchant.trim(),
            amount: Number(transaction.amount),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response)
        );
      }

      setTransaction({
        date: "",
        merchant: "",
        amount: "",
      });

      setShowTransactionForm(false);

      if (showTransactions) {
        await loadTransactions(currentUserId);
      }

      setMessage(
        "Transaction added successfully."
      );

    } catch (error) {
      setMessage(
        `Unable to add transaction: ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  }

  // --------------------------------
  // Open Excel selector
  // --------------------------------

  function openFileSelector() {
    fileInputRef.current?.click();
  }

  // --------------------------------
  // Upload Excel
  // --------------------------------

  async function uploadExcelFile(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setMessage(
        "Please choose an .xlsx Excel file."
      );

      event.target.value = "";

      return;
    }

      const formData = new FormData();

      formData.append(
        "user_id",
        String(currentUserId)
      );

      formData.append(
        "file",
        file
      );
    try {
      setIsLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/v1/transactions/upload-excel`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response)
        );
      }

      const result = await response.json();

      if (showTransactions) {
        await loadTransactions();
      }

      setMessage(
        `Excel upload completed. ${
          result.rows_added ?? 0
        } transactions added.`
      );

    } catch (error) {
      setMessage(
        `Unable to upload Excel file: ${error.message}`
      );
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }

  // --------------------------------
  // SINGLE DELETE
  // --------------------------------

 async function deleteTransaction(transactionId) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this transaction?"
  );

  if (!confirmed) {
    return;
  }

  try {
    setIsLoading(true);
    setMessage("");

    const response = await fetch(
      `${API_URL}/api/v1/transactions/${transactionId}` +
      `?user_id=${currentUserId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response)
      );
    }

    await loadTransactions(currentUserId);

    setSelectedIds((currentIds) =>
      currentIds.filter(
        (id) => id !== transactionId
      )
    );

    setMessage(
      "Transaction deleted successfully."
    );

  } catch (error) {
    console.error(
      "Single delete error:",
      error
    );

    setMessage(
      `Unable to delete transaction: ${error.message}`
    );

  } finally {
    setIsLoading(false);
  }
}

  // --------------------------------
  // Select / unselect one row
  // --------------------------------

  function toggleTransactionSelection(transactionId) {
    setSelectedIds((currentIds) => {

      if (currentIds.includes(transactionId)) {
        return currentIds.filter(
          (id) => id !== transactionId
        );
      }

      return [
        ...currentIds,
        transactionId,
      ];
    });
  }

  // --------------------------------
  // Select / unselect ALL
  // --------------------------------
 function normalizeDate(value) {
  if (!value) {
    return "";
  }

  const text = String(value).trim();


  // Format 1:
  // YYYY-MM-DD
  // Example: 2026-06-01

  let match = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})/
  );

  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, "0");
    const day = match[3].padStart(2, "0");

    return `${year}-${month}-${day}`;
  }


  // Format 2:
  // M/D/YYYY or MM/DD/YYYY
  // Example: 6/15/2026

  match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (match) {
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    const year = match[3];

    return `${year}-${month}-${day}`;
  }


  return "";
}



 function toggleSelectAllFiltered() {
  const filteredIds =
    filteredTransactions.map(
      (transaction) => transaction.id
    );

  const allFilteredSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) =>
      selectedIds.includes(id)
    );

  if (allFilteredSelected) {
    setSelectedIds((currentIds) =>
      currentIds.filter(
        (id) => !filteredIds.includes(id)
      )
    );
  } else {
    setSelectedIds((currentIds) => [
      ...new Set([
        ...currentIds,
        ...filteredIds,
      ]),
    ]);
  }
}

  // --------------------------------
  // GROUP DELETE
  // --------------------------------

async function deleteSelectedTransactions() {
  if (selectedFilteredIds.length === 0) {
    setMessage(
      "Please select at least one visible transaction."
    );

    return;
  }

  const confirmed = window.confirm(
    `Delete ${selectedFilteredIds.length} selected transaction(s)?`
  );

  if (!confirmed) {
    return;
  }

  try {
    setIsLoading(true);
    setMessage("");

    const response = await fetch(
      `${API_URL}/api/v1/transactions/bulk-delete`,
      {
        method: "DELETE",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          user_id: currentUserId,
          ids: selectedFilteredIds,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response)
      );
    }

    const result = await response.json();

    setSelectedIds([]);

    await loadTransactions(currentUserId);

    setMessage(
      `${result.deleted_count} transaction(s) deleted successfully.`
    );

  } catch (error) {
    console.error(
      "Bulk delete error:",
      error
    );

    setMessage(
      `Unable to delete selected transactions: ${error.message}`
    );

  } finally {
    setIsLoading(false);
  }
}

  // --------------------------------
  // Show / hide table
  // --------------------------------

async function handleShowTransactions() {
  if (showTransactions) {
    // Close transaction area
    setShowTransactions(false);
    setFilterApplied(false);
    setSelectedIds([]);
    return;
  }



  // Load this user's transactions,
  // but keep them hidden until a filter is applied
  await loadTransactions(currentUserId);

    // Open filter area
  setShowTransactions(true);

  // Do not show results yet
  setFilterApplied(false);

  setSelectedIds([]);
}

function applyFilters() {
  const hasFilter =
    filters.merchant.trim() !== "" ||
    filters.startDate !== "" ||
    filters.endDate !== "" ||
    filters.transactionType !== "all";

  if (!hasFilter) {
    setMessage(
      "Please select at least one filter before showing transactions."
    );

    return;
  }

  console.log("Applying filters:", filters)

  setSelectedIds([]);
  setFilterApplied(true);
  setMessage("");
}

const filteredTransactions = useMemo(() => {
  let result = [...transactions];

  // -----------------------------
  // Merchant filter
  // -----------------------------

  if (filters.merchant.trim() !== "") {
    const merchantSearch =
      filters.merchant.trim().toLowerCase();

    result = result.filter((item) =>
      String(item.merchant || "")
        .trim()
        .toLowerCase()
        .includes(merchantSearch)
    );
  }

  // -----------------------------
  // Start date filter
  // -----------------------------

  if (filters.startDate !== "") {
    const startDate = normalizeDate(
        filters.startDate
      );


    result = result.filter((item) => {
        const transactionDate =
          normalizeDate(item.date);
  

        return transactionDate >= startDate;
    });
}

  // -----------------------------
  // End date filter
  // -----------------------------

  if (filters.endDate !== "") {
    const endDate = normalizeDate(
        filters.endDate
      );

    result = result.filter((item) => {
        const transactionDate =
          normalizeDate(item.date);

        return transactionDate <= endDate;
      });
  }

  // -----------------------------
  // Income / expense filter
  // -----------------------------

  if (filters.transactionType && 
      filters.transactionType !== "all") {
    result = result.filter(
      (item) =>
        String(
          item.transaction_type || ""
        ).toLowerCase() ===
        filters.transactionType
          .toLowerCase()
    );
  }

  // -----------------------------
  // Sorting
  // -----------------------------

  result.sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === "amount") {
      aValue = Number(a.amount);
      bValue = Number(b.amount);
    } 

    else if (
      sortField === "date"
    ) {
      aValue = normalizeDate(a.date);
      bValue = normalizeDate(b.date);
    }

    else {
      aValue =
        String(
          a[sortField] || ""
        ).toLowerCase();
      bValue =
        String(
          b[sortField] || ""
        ).toLowerCase();
    }

    if (aValue < bValue) {
      return sortDirection === "asc"
        ? -1
        : 1;
    }


    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1;
    }

    return 0;
  });


  console.log(
    "All transactions:",
    transactions
  );

  console.log(
    "Applied filters:",
    filterApplied
  );

  console.log(
    "Filtered transactions:",
    result
  );



  return result;
}, [
  transactions,
  filters,
  sortField,
  sortDirection,
]);

const selectedFilteredIds = useMemo(() => {
  const visibleIds = new Set(
    filteredTransactions.map(
      (transaction) => transaction.id
    )
  );

  return selectedIds.filter(
    (id) => visibleIds.has(id)
  );
}, [
  selectedIds,
  filteredTransactions,
]);

  // -----------------------------
  // exporting to excel file
  // -----------------------------


async function exportSelectedTransactions() {
  if (selectedFilteredIds.length === 0) {
    setMessage(
      "Please select at least one visible transaction to export."
    );

    return;
  }

  try {
    setIsLoading(true);
    setMessage("");

    const response = await fetch(
      `${API_URL}/api/v1/transactions/export-excel`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          user_id: currentUserId,
          ids: selectedFilteredIds,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response)
      );
    }

    // Excel response is binary data,
    // not JSON.
    const excelBlob =
      await response.blob();

    const downloadUrl =
      window.URL.createObjectURL(
        excelBlob
      );

    const downloadLink =
      document.createElement("a");

    downloadLink.href =
      downloadUrl;

    downloadLink.download =
      "budget_transactions.xlsx";

    document.body.appendChild(
      downloadLink
    );

    downloadLink.click();

    downloadLink.remove();

    window.URL.revokeObjectURL(
      downloadUrl
    );

    setMessage(
      `${selectedFilteredIds.length} transaction(s) exported successfully.`
    );

  } catch (error) {
    console.error(
      "Excel export error:",
      error
    );

    setMessage(
      `Unable to export transactions: ${error.message}`
    );

  } finally {
    setIsLoading(false);
  }
}


  return (
    <main className="app">

      <section className="hero-card">

        <div className="top-bar">

          <div>
            <p className="eyebrow">
              Personal budgeting application
            </p>

            <h1>Budget Tool</h1>
          </div>

          <div className="user-profile">

            <div className="user-avatar">
              {currentUser.name.charAt(0)}
            </div>

            <div className="user-profile-info">

              <label htmlFor="user-select">
                Profile
              </label>

              <select
                id="user-select"
                value={currentUserId}
                onChange={changeUser}
              >
                {USERS.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.name}
                  </option>
                ))}
              </select>

            </div>

          </div>

        </div>

        <p className="description">
          Add transactions manually,
          upload an Excel file,
          or view existing transactions.
        </p>

            <p className="current-profile">
              Current profisle: <strong>{currentUser.name}</strong>
            </p>

        {/* MAIN BUTTONS */}

        <div className="button-row">

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              setShowTransactionForm(
                (currentValue) =>
                  !currentValue
              )
            }
            disabled={isLoading}
          >
            Add Transaction
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={openFileSelector}
            disabled={isLoading}
          >
            Upload Excel File
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={handleShowTransactions}
            disabled={isLoading}
          >
            {showTransactions
              ? "Hide Transactions"
              : "Show Transactions"}
          </button>

          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept=".xlsx"
            onChange={uploadExcelFile}
          />

        </div>

        {/* ADD FORM */}

        {showTransactionForm && (

          <form
            className="transaction-form"
            onSubmit={submitTransaction}
          >

            <div className="form-field">

              <label htmlFor="date">
                Date
              </label>

              <input
                id="date"
                name="date"
                type="date"
                value={transaction.date}
                onChange={updateTransactionField}
                required
              />

            </div>

            <div className="form-field">

              <label htmlFor="merchant">
                Merchant
              </label>

              <input
                id="merchant"
                name="merchant"
                type="text"
                placeholder="Example: Costco"
                value={transaction.merchant}
                onChange={updateTransactionField}
                required
              />

            </div>

            <div className="form-field">

              <label htmlFor="amount">
                Amount
              </label>

              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                placeholder="Income: 3000 or Expense: -180.50"
                value={transaction.amount}
                onChange={updateTransactionField}
                required
              />

            </div>

            <div className="form-actions">

              <button
                type="submit"
                className="primary-button"
                disabled={isLoading}
              >
                {isLoading
                  ? "Saving..."
                  : "Save Transaction"}
              </button>

              <button
                type="button"
                className="cancel-button"
                onClick={() =>
                  setShowTransactionForm(false)
                }
                disabled={isLoading}
              >
                Cancel
              </button>

            </div>

          </form>
        )}

        {/* TRANSACTION TABLE */}

        {showTransactions && (
        
          <div className="transaction-list">

            <div className="transaction-list-header">

              <div className="filter-panel">

                <h3>Select Transactions to show</h3>

                <div className="filter-grid">

                  <div className="form-field">
                    <label htmlFor="merchant-filter">
                      Merchant
                    </label>

                    <input
                      id="merchant-filter"
                      name="merchant"
                      type="text"
                      placeholder="Example: Costco"
                      value={filters.merchant}
                      onChange={updateFilter}
                    />
                  </div>


                  <div className="form-field">
                    <label htmlFor="start-date">
                      From Date
                    </label>

                    <input
                      id="start-date"
                      name="startDate"
                      type="date"
                      value={filters.startDate}
                      onChange={updateFilter}
                    />
                  </div>


                  <div className="form-field">
                    <label htmlFor="end-date">
                      To Date
                    </label>

                    <input
                      id="end-date"
                      name="endDate"
                      type="date"
                      value={filters.endDate}
                      onChange={updateFilter}
                    />
                  </div>


                  <div className="form-field">
                    <label htmlFor="transaction-type">
                      Transaction Type
                    </label>

                    <select
                      id="transaction-type"
                      name="transactionType"
                      value={filters.transactionType}
                      onChange={updateFilter}
                    >
                      <option value="all">
                        All
                      </option>

                      <option value="income">
                        Income
                      </option>

                      <option value="expense">
                        Expense
                      </option>
                    </select>
                  </div>


                  <div className="form-field">
                    <label htmlFor="sort-field">
                      Order By
                    </label>

                    <select
                      id="sort-field"
                      value={sortField}
                      onChange={(event) =>
                        setSortField(event.target.value)
                      }
                    >
                      <option value="date">
                        Date
                      </option>

                      <option value="merchant">
                        Merchant
                      </option>

                      <option value="amount">
                        Amount
                      </option>
                    </select>
                  </div>


                  <div className="form-field">
                    <label htmlFor="sort-direction">
                      Direction
                    </label>

                    <select
                      id="sort-direction"
                      value={sortDirection}
                      onChange={(event) =>
                        setSortDirection(
                          event.target.value
                        )
                      }
                    >
                      <option value="asc">
                        Ascending
                      </option>

                      <option value="desc">
                        Descending
                      </option>
                    </select>
                  </div>

                </div>

            <div className="filter-actions">

              <button
                type="button"
                className="primary-button"
                onClick={applyFilters}
              >
                Apply Filter
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={resetFilters}
              >
                Reset Filters
              </button>

            </div>
          
           </div>

           </div>

           {/* Results only appear after Apply Filter */}

           {filterApplied && (
              <div className="transaction-results">

                <p>
                  Showing {filteredTransactions.length}
                  {" "}of {transactions.length}
                  {" "}transactions
                </p>


            {filteredTransactions.length === 0 ? (

                <p className="message">
                  No transactions match the selected filters.
                </p>

            ) : (
              <>
              <h4>
                Existing Transactions
              </h4>

              <div className="transaction-actions">

                <button
                  type="button"
                  className="delete-selected-button"
                  onClick={deleteSelectedTransactions}
                  disabled={
                    isLoading ||
                    selectedFilteredIds.length === 0
                  }
                >
                  Delete Selected
                  {selectedFilteredIds.length > 0
                    ? ` (${selectedFilteredIds.length})`
                    : ""}
                </button>

                <button
                  type="button"
                  className="export-button"
                  onClick={exportSelectedTransactions}
                  disabled={
                    isLoading ||
                    selectedFilteredIds.length === 0
                  }
                >
                  Export Selected
                  {selectedFilteredIds.length > 0
                    ? ` (${selectedFilteredIds.length})`
                    : ""}
                </button>

              </div>
              <table>

                <thead>

                  <tr>

                    <th>
                      <input
                        type="checkbox"
                        checked={
                          filteredTransactions.length > 0 &&
                          filteredTransactions.every(
                              (item) =>
                              selectedIds.includes(item.id)
                            )
                        }
                        onChange={toggleSelectAllFiltered}
                      />
                    </th>

                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Action</th>

                  </tr>

                </thead>

                <tbody>

                  {filteredTransactions.map(
                    (item) => (

                      <tr key={item.id}>

                        <td>

                          <input
                            type="checkbox"
                            checked={selectedIds.includes(
                              item.id
                            )}
                            onChange={() =>
                              toggleTransactionSelection(
                                item.id
                              )
                            }
                          />

                        </td>

                        <td>
                          {item.date}
                        </td>

                        <td>
                          {item.merchant}
                        </td>

                        <td>
                          $
                          {Number(
                            item.amount
                          ).toFixed(2)}
                        </td>

                        <td>
                          {
                            item.transaction_type
                          }
                        </td>

                        <td>

                          <button
                            type="button"
                            className="single-delete-button"
                            onClick={() =>
                              deleteTransaction(
                                item.id
                              )
                            }
                            disabled={isLoading}
                          >
                            Delete
                          </button>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>
             </>
            )}

          </div>
        )}

        {message && (

          <div
            className="message"
            role="status"
          >
            {message}
          </div>

        )}
        
        </div> )}
    </section>
  </main> 
  )}
