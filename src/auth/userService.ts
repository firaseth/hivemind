/**
 * 4.2 Multi‑User Support
 * Minimal user service for local account management.
 */

export interface User {
  id: string;
  username: string;
  settings: Record<string, any>;
}

export class UserService {
  private users: Map<string, User> = new Map();

  async createUser(username: string): Promise<User> {
    const user: User = {
      id: `user-${Date.now()}`,
      username,
      settings: {}
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }
}

export const globalUserService = new UserService();
