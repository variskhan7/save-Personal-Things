export interface PasswordEntry {
  id?: string;
  userId: string;
  title: string;
  username: string;
  password: string;
  category: 'social' | 'work' | 'other';
  isWeak: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GovernmentDoc {
  id?: string;
  userId: string;
  title: string;
  username: string;
  password: string;
  createdAt: string;
}

export interface PersonalDoc {
  id?: string;
  userId: string;
  aadharNumber?: string;
  drivingLicense?: string;
  panNumber?: string;
  marksheetRollNumber?: string;
  otherDocs?: string;
  createdAt: string;
}

export interface BankDetail {
  id?: string;
  userId: string;
  bankName: string;
  accountNumber: string;
  ifscCode?: string;
  atmCardDetails?: string;
  createdAt: string;
}
