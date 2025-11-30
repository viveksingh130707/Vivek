// ======== Data Model ========

let tasks = [];
const STORAGE_KEY = "mini_trello_tasks";

// DOM elements
const searchInput = document.getElementById("searchInput");
const priorityFilter = document.getElementById("priorityFilter");
const addTaskBtn = document.getElementById("addTaskBtn");

const taskForm = document.getElementById("taskForm");
const formTitle = document.getElementById("formTitle");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const titleInput = document.getElementById("titleInput");
const descInput = document.getElementById("descInput");
const priorityInput = document.getElementById("priorityInput");
const tagsInput = document.getElementById("tagsInput");
const dueDateInput = document.getElementById("dueDateInput");
const statusInput = document.getElementById("statusInput");
const taskIdInput = document.getElementById("taskId");

// Columns
const colTodo = document.getElementById("col-todo");
const colInProgress = document.getElementById("col-inprogress");
const colDone = document.getElementById("col-done");
const columns = {
  TODO: colTodo,
  IN_PROGRESS: colInProgress,
  DONE: colDone
};

// Trash
const trashBody = document.getElementById("trashBody");
const emptyTrashBtn = document.getElementById("emptyTrashBtn");

// ======== Storage ========

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    tasks = [];
    return;
  }
  try {
    tasks = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse stored tasks", e);
    tasks = [];
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ======== Helpers ========

function generateId() {
  return "T" + Math.floor(Math.random() * 100000);
}

function resetForm() {
  taskIdInput.value = "";
  titleInput.value = "";
  descInput.value = "";
  priorityInput.value = "medium";
  tagsInput.value = "";
  dueDateInput.value = "";
  statusInput.value = "TODO";
  formTitle.textContent = "Create Task";
}

function populateForm(task) {
  taskIdInput.value = task.id;
  titleInput.value = task.title;
  descInput.value = task.description || "";
  priorityInput.value = task.priority || "medium";
  tagsInput.value = task.tags ? task.tags.join(", ") : "";
  dueDateInput.value = task.dueDate || "";
  statusInput.value = task.status;
  formTitle.textContent = "Edit Task";
}

// ======== CRUD ========

function upsertTaskFromForm() {
  const id = taskIdInput.value || generateId();
  const isNew = !taskIdInput.value;

  const newTask = {
    id,
    title: titleInput.value.trim(),
    description: descInput.value.trim(),
    status: statusInput.value,
    priority: priorityInput.value,
    tags: tagsInput.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    dueDate: dueDateInput.value || null,
    deleted: false
  };

  if (!newTask.title) return; // simple guard

  if (isNew) {
    tasks.push(newTask);
  } else {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx !== -1) tasks[idx] = { ...tasks[idx], ...newTask };
  }

  saveToStorage();
  resetForm();
  renderBoard();
}

function softDeleteTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.deleted = true;
  saveToStorage();
  renderBoard();
}

function restoreTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.deleted = false;
  // when restoring, put it back to TODO if it had no status
  task.status = task.status || "TODO";
  saveToStorage();
  renderBoard();
}

function deleteForever(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveToStorage();
  renderBoard();
}

function emptyTrash() {
  if (!confirm("Permanently delete all items in Trash?")) return;
  tasks = tasks.filter((t) => !t.deleted);
  saveToStorage();
  renderBoard();
}

// ======== Drag & Drop ========

function handleDragStart(e) {
  const id = e.currentTarget.dataset.id;
  e.dataTransfer.setData("text/plain", id);
  e.currentTarget.classList.add("dragging");
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDrop(e) {
  e.preventDefault();
  const id = e.dataTransfer.getData("text/plain");
  const columnBody = e.currentTarget;

  const status = columnBody.parentElement.getAttribute("data-status");

  const card = document.querySelector(`.task-card[data-id="${id}"]`);
  if (!card) return;

  columnBody.appendChild(card); // visually move
  columnBody.classList.remove("drag-over");

  // Sync tasks from DOM
  syncTasksFromDOM();
  saveToStorage();
  renderBoard();
}

function syncTasksFromDOM() {
  Object.entries(columns).forEach(([status, colEl]) => {
    const cards = colEl.querySelectorAll(".task-card");
    cards.forEach((card) => {
      const id = card.dataset.id;
      const task = tasks.find((t) => t.id === id);
      if (task) {
        task.status = status;
      }
    });
  });
}

// ======== Rendering ========

function clearColumns() {
  Object.values(columns).forEach((col) => {
    col.innerHTML = "";
  });
  trashBody.innerHTML = "";
}

function createTaskCard(task) {
  const card = document.createElement("div");
  card.className = "task-card";
  card.draggable = true;
  card.dataset.id = task.id;

  card.addEventListener("dragstart", handleDragStart);
  card.addEventListener("dragend", handleDragEnd);

  const titleEl = document.createElement("div");
  titleEl.className = "task-title";
  titleEl.textContent = task.title;

  const descEl = document.createElement("div");
  descEl.className = "task-desc";
  descEl.textContent = task.description || "";

  const metaEl = document.createElement("div");
  metaEl.className = "task-meta";

  // Priority
  const pri = document.createElement("span");
  pri.textContent = "Priority: " + (task.priority || "medium");
  pri.classList.add(
    "priority-" + (task.priority || "medium").toLowerCase()
  );
  metaEl.appendChild(pri);

  // Tags
  if (task.tags && task.tags.length > 0) {
    task.tags.forEach((tag) => {
      const tagEl = document.createElement("span");
      tagEl.className = "tag";
      tagEl.textContent = tag;
      metaEl.appendChild(tagEl);
    });
  }

  // Footer
  const footer = document.createElement("div");
  footer.className = "task-footer";

  const dueSpan = document.createElement("span");
  if (task.dueDate) dueSpan.textContent = "Due: " + task.dueDate;
  footer.appendChild(dueSpan);

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const editBtn = document.createElement("button");
  editBtn.textContent = "✏️";
  editBtn.title = "Edit";
  editBtn.addEventListener("click", () => {
    populateForm(task);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const delBtn = document.createElement("button");
  delBtn.textContent = "🗑️";
  delBtn.title = "Delete";
  delBtn.addEventListener("click", () => {
    if (confirm("Move this task to Trash?")) {
      softDeleteTask(task.id);
    }
  });

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  footer.appendChild(actions);

  card.appendChild(titleEl);
  if (task.description) card.appendChild(descEl);
  card.appendChild(metaEl);
  card.appendChild(footer);

  return card;
}

function createTrashCard(task) {
  const card = document.createElement("div");
  card.className = "trash-card";

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;

  const info = document.createElement("div");
  info.className = "task-desc";
  info.textContent =
    (task.description || "No description") +
    (task.dueDate ? ` • Due: ${task.dueDate}` : "");

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const restoreBtn = document.createElement("button");
  restoreBtn.textContent = "↩ Restore";
  restoreBtn.addEventListener("click", () => restoreTask(task.id));

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "❌ Delete";
  deleteBtn.addEventListener("click", () => {
    if (confirm("Delete permanently?")) {
      deleteForever(task.id);
    }
  });

  actions.appendChild(restoreBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(title);
  card.appendChild(info);
  card.appendChild(actions);

  return card;
}

function renderBoard() {
  clearColumns();

  const searchTerm = searchInput.value.trim().toLowerCase();
  const priorityVal = priorityFilter.value;

  // Active tasks in columns
  tasks
    .filter((t) => !t.deleted)
    .filter((t) => {
      if (!priorityVal) return true;
      return t.priority === priorityVal;
    })
    .filter((t) => {
      if (!searchTerm) return true;
      const inTitle = t.title.toLowerCase().includes(searchTerm);
      const inTags =
        t.tags &&
        t.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm)
        );
      return inTitle || inTags;
    })
    .forEach((task) => {
      const col = columns[task.status] || colTodo;
      const card = createTaskCard(task);
      col.appendChild(card);
    });

  // Deleted tasks → Trash view
  tasks
    .filter((t) => t.deleted)
    .forEach((task) => {
      const tCard = createTrashCard(task);
      trashBody.appendChild(tCard);
    });
}

// ======== Events ========

// Form submit
taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  upsertTaskFromForm();
});

// Cancel edit
cancelEditBtn.addEventListener("click", () => {
  resetForm();
});

// New task button
addTaskBtn.addEventListener("click", () => {
  resetForm();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Filters
searchInput.addEventListener("input", renderBoard);
priorityFilter.addEventListener("change", renderBoard);

// Empty trash
emptyTrashBtn.addEventListener("click", emptyTrash);

// Column drag listeners
Object.values(columns).forEach((colBody) => {
  colBody.addEventListener("dragover", handleDragOver);
  colBody.addEventListener("drop", handleDrop);

  colBody.addEventListener("dragenter", (e) => {
    e.preventDefault();
    colBody.classList.add("drag-over");
  });
  colBody.addEventListener("dragleave", () => {
    colBody.classList.remove("drag-over");
  });
});

// ======== Init ========

loadFromStorage();
renderBoard();
resetForm();