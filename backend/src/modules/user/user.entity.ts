import {
  BeforeCreate,
  BeforeUpdate,
  Collection,
  Embeddable,
  Embedded,
  Entity,
  EntityRepositoryType,
  EventArgs,
  OneToMany,
  Property,
} from '@mikro-orm/core'
import { BaseEntity } from '../common/base.entity.js'
import { hash, verify } from 'argon2'
import { UserRepository } from './user.repository.js'
import { Exhibit } from '../exhibit/exhibit.entity.js'
import { Table } from '../table/table.entity.js'

@Embeddable()
export class Contacts {
  @Property()
  mastodon?: string

  @Property()
  phone?: string

  @Property()
  email?: string

  @Property()
  website?: string
}

@Entity({ repository: () => UserRepository })
export class User extends BaseEntity<
  'password' | 'isAdministrator' | 'fullName' | 'bio' | 'contacts'
> {
  // for automatic inference via `em.getRepository(User)`
  [EntityRepositoryType]?: UserRepository

  @Property()
  fullName: string = ''

  @Property({ unique: true, index: true })
  username!: string

  @Property({ persist: false })
  token?: string

  @Property({ lazy: true })
  password?: string

  @Property({ type: 'text' })
  bio: string = ''

  @Property()
  isAdministrator: boolean = false

  @Embedded(() => Contacts, { object: true })
  contacts: Contacts = {}

  @OneToMany({ mappedBy: 'exhibitor' })
  exhibits = new Collection<Exhibit>(this)

  @OneToMany({ mappedBy: 'exhibitor' })
  tables = new Collection<Table>(this)

  constructor(username: string, password: string) {
    super()
    this.username = username
    this.password = password // keep plain text, will be hashed via hooks
  }

  @BeforeCreate()
  @BeforeUpdate()
  async hashPassword(args: EventArgs<User>) {
    // hash only if the password was changed
    const password = args.changeSet?.payload.password

    if (password) {
      this.password = await hash(password)
    }
  }

  async verifyPassword(password: string) {
    return this.password && verify(this.password, password)
  }
}
