const USER_KEY = "rentmateUser";

export function getUser() {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY));

    if (!user || !user.id || !user.name || !user.email) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function saveUser(user) {
  const normalizedUser = {
    id: user.id || crypto.randomUUID(),
    name: user.name.trim(),
    email: user.email.trim().toLowerCase(),
    role: user.role || "Renter",
    verified: Boolean(user.verified),
    createdAt: user.createdAt || new Date().toISOString(),
  };

  localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));

  return normalizedUser;
}

export function logoutUser() {
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return Boolean(getUser());
}