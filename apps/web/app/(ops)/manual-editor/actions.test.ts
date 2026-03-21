import { describe, it } from 'vitest'

describe('manual editor actions', () => {
  it.todo('saveManualPage creates version snapshot before updating content')

  it.todo('saveManualPage does not create version if content unchanged')

  it.todo('createManualPage rejects invalid slug characters')

  it.todo('createManualPage accepts valid slug with hyphens and lowercase')

  it.todo('getManualPage returns null for nonexistent id')

  it.todo('togglePublish flips published state')
})

describe('manual page context isolation', () => {
  it.todo('getClientManualPage with prison context returns null')

  it.todo('getPrisonManualPage with client context returns null')
})
