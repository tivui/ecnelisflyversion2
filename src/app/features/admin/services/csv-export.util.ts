import { AdminUser } from './user-management.service';

export function exportUsersCsv(users: AdminUser[], filename: string): void {
  const headers = [
    'Username',
    'Email',
    'Country',
    'Type',
    'Status',
    'Role',
    'Sounds',
    'Provider',
    'Registration Date',
  ];

  const rows = users.map((u) => [
    u.username,
    u.email,
    u.country ?? '',
    u.email.startsWith('imported_') ? 'imported' : 'registered',
    u.cognitoEnabled === false ? 'disabled' : u.cognitoEnabled === true ? 'active' : 'N/A',
    (u.cognitoGroups ?? []).includes('ADMIN') ? 'admin' : 'user',
    u.soundCount,
    u.cognitoProvider ?? '',
    u.cognitoCreatedAt ?? '',
  ]);

  const csv = [headers, ...rows]
    .map((r) =>
      r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
    )
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
