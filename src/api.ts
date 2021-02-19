// TODO: Export this outside of this project because it's probably useful.
export type DocumentPrivacy =
    | 'Public'
    | 'InstructorsOnly'
    | 'LinkOnly'
    | 'Private'

export type ApiVersion = 'v1'

export type UserId = number
export type DocumentId = number

export interface Info {
    version: ApiVersion
    ident: string
}

export interface Document {
    creator: UserId
    date: string
    scope: DocumentPrivacy
    id: DocumentId
    description?: string
    filename: string
}
