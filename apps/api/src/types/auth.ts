export interface Account {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer';
}

export interface AdminAccount {
  adminId: string;
  name: string;
  email: string;
  role: 'admin';
}

export interface RegisterInput {
  name: string;
  email: string;
  countryCode: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
