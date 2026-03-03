### 1. Project Overview

A task-tracking tool for small teams. It allows users to create projects, assign tasks, and track progress in real-time. The main goal is to keep data synchronized between all users instantly and provide a user-friendly interface.

### 2. Functional Requirements

#### 2.1. Authentication and User Profile

* Registration and Login using Email/Password.
* Support for Social Login (Google/GitHub).
* Ability to update the user profile (change avatar and display name).
* **Route Protection:** Only authorized users can access the dashboard.

#### 2.2. Project and Task Management

* **Projects:** Users can create, edit, and delete projects. Each project has a title, description, and a list of members.
* **Tasks:** Inside a project, users can create tasks with: title, status (To Do, In Progress, Done), priority, and an assigned user.
* **Real-time Updates:** If one member changes a task status, the change must appear instantly for all other members looking at the same project.

#### 2.3. External Data (Dashboard)

* Integration with an external API (e.g., JSONPlaceholder or a public Currency/News API).
* A widget on the main dashboard showing live data from this API.

### 3. Technical Implementation Requirements

#### 3.1. Data Architecture and Storage

* Use a cloud-based storage system for user data, projects, and tasks.
* **Data Security:** Implement rules so users can only see projects they are invited to.

#### 3.2. State Management

* Use a centralized global state to manage:
* Current user information.
* Interface settings (e.g., Dark/Light mode).
* Global notifications (Toast messages).



#### 3.3. API Interaction and Caching

* Optimize all external API requests: implement data caching to avoid unnecessary network calls.
* Handle "Loading" and "Error" states for all asynchronous operations.
* Use a standardized HTTP client with a base configuration (Base URL, interceptors for headers) to communicate with external services.

---

### 4. User Interface (UI)

* **Dashboard:** A summary of recent tasks and the external data widget.
* **Project View:** A Kanban-style board with columns for different statuses.
* **Profile Page:** A form to edit user details with input validation.

### 5. Acceptance Criteria

1. A user can register and see their name in the navigation bar.
2. The app works with "live" data: if you open the app in two different browsers, changes in one must show in the other without a page refresh.
3. External API data loads with a spinner and stays cached for a specific time.
4. The code is organized into layers: components, API services, and state stores.