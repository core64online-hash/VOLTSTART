import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AddCartItemSchema,
  CheckoutInputSchema,
  CreateCartSchema,
  DeliveryMethodSchema,
  UpdateCartItemSchema,
  type JwtPayload,
} from '@voltstar/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/auth/optional-jwt-auth.guard';
import { RateLimit } from '../../common/security/rate-limit';
import { buyerFrom } from './buyer-context';
import { CartService } from './cart.service';
import { CheckoutService } from './checkout.service';

/** Кошик доступний гостям; з токеном — ціни за сегментом користувача. */
@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(OptionalJwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly carts: CartService) {}

  @Post()
  create(@Body() body: unknown, @CurrentUser() user?: JwtPayload) {
    return this.carts.create(CreateCartSchema.parse(body ?? {}), buyerFrom(user));
  }

  @Get(':id')
  get(@Param('id') id: string, @Query('delivery') delivery?: string, @CurrentUser() user?: JwtPayload) {
    const method = delivery ? DeliveryMethodSchema.parse(delivery) : undefined;
    return this.carts.get(id, buyerFrom(user), method);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user?: JwtPayload) {
    return this.carts.addItem(id, AddCartItemSchema.parse(body), buyerFrom(user));
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentUser() user?: JwtPayload,
  ) {
    const { quantity } = UpdateCartItemSchema.parse(body);
    return this.carts.updateItem(id, itemId, quantity, buyerFrom(user));
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @CurrentUser() user?: JwtPayload) {
    return this.carts.removeItem(id, itemId, buyerFrom(user));
  }
}

@ApiTags('checkout')
@ApiBearerAuth()
@UseGuards(OptionalJwtAuthGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  /** Оформлення замовлення: B2C — оплата карткою, B2B/B2G — рахунок. */
  @Post()
  @HttpCode(201)
  @RateLimit({ name: 'checkout', limit: 20, windowSec: 600 })
  checkout(@Body() body: unknown, @CurrentUser() user?: JwtPayload) {
    return this.checkoutService.checkout(CheckoutInputSchema.parse(body), buyerFrom(user));
  }
}
