import { getUsers } from './actions'
import { UsersTable } from './users-table'

export async function UsersTab() {
  const users = await getUsers()
  return <UsersTable users={users} />
}
