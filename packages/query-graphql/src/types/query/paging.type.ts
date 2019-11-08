import { Paging } from '@nestjs-query/core';
import { Min, Validate } from 'class-validator';
import { ArgsType, Field, InputType, Int } from 'type-graphql';
import { cursorToOffset } from 'graphql-relay';
import { ConnectionCursor, ConnectionCursorScalar } from '../cursor.scalar';
import { CannotUseWith, CannotUseWithout, IsUndefined } from '../validators';

export interface CursorPagingType extends Paging {
  before?: ConnectionCursor;
  after?: ConnectionCursor;
  first?: number;
  last?: number;
}

@ArgsType()
@InputType()
export class GraphQLCursorPaging implements CursorPagingType {
  @Field(() => ConnectionCursorScalar, {
    nullable: true,
    description: 'Paginate before opaque cursor',
  })
  @IsUndefined()
  @Validate(CannotUseWithout, ['last'])
  @Validate(CannotUseWith, ['after', 'first'])
  before?: ConnectionCursor;

  @Field(() => ConnectionCursorScalar, {
    nullable: true,
    description: 'Paginate after opaque cursor',
  })
  @IsUndefined()
  @Validate(CannotUseWithout, ['first'])
  @Validate(CannotUseWith, ['before', 'last'])
  after?: ConnectionCursor;

  @Field(() => Int, { nullable: true, description: 'Paginate first' })
  @IsUndefined()
  @Min(1)
  @Validate(CannotUseWith, ['before', 'last'])
  first?: number;

  @Field(() => Int, { nullable: true, description: 'Paginate last' })
  @IsUndefined()
  // Required `before`. This is a weird corner case.
  // We'd have to invert the ordering of query to get the last few items then re-invert it when emitting the results.
  // We'll just ignore it for now.
  @Validate(CannotUseWithout, ['before'])
  @Validate(CannotUseWith, ['after', 'first'])
  @Min(1)
  last?: number;

  get limit(): number | undefined {
    if (this.isForwardPaging) {
      return this.first || 0;
    }
    if (this.isBackwardPaging) {
      const { last = 0, before } = this;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const offset = cursorToOffset(before!) - last;
      // Check to see if our before-page is underflowing past the 0th item
      if (offset < 0) {
        // Adjust the limit with the underflow value
        return Math.max(last + offset, 0);
      }
      return last;
    }
    return undefined;
  }

  get offset(): number | undefined {
    if (this.isForwardPaging) {
      const { after } = this;
      const limit = after ? cursorToOffset(after) + 1 : 0;
      return Math.max(limit, 0);
    }
    if (this.isBackwardPaging) {
      const { last, before } = this;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const offset = last ? cursorToOffset(before!) - last : 0;

      // Check to see if our before-page is underflowing past the 0th item
      return Math.max(offset, 0);
    }
    return undefined;
  }

  private get isForwardPaging(): boolean {
    return !!this.first || !!this.after;
  }

  private get isBackwardPaging(): boolean {
    return !!this.last || !!this.before;
  }
}
