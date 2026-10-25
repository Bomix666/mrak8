from django.conf import settings
from django.contrib import admin, messages
from django.utils.html import format_html

from .models import Category, Collection, Inventory, Product, ProductDetail, ProductImage


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'order', 'product_count')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('order', 'name')

    def product_count(self, obj):
        return obj.products.count()
    product_count.short_description = 'Products'


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'launch_date', 'product_count')
    list_filter = ('is_active',)
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}

    def product_count(self, obj):
        return obj.products.count()
    product_count.short_description = 'Products'


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ('image', 'angle', 'order', 'alt_text', 'preview')
    readonly_fields = ('preview',)

    def preview(self, obj):
        if obj.pk and obj.image:
            return format_html('<img src="{}" style="height:60px;object-fit:cover;" />', obj.image.url)
        return '—'
    preview.short_description = 'Preview'


class ProductDetailInline(admin.TabularInline):
    model = ProductDetail
    extra = 1
    fields = ('text', 'order')


class InventoryInline(admin.TabularInline):
    model = Inventory
    extra = 0
    max_num = 5
    can_delete = False
    fields = ('size', 'quantity')

    def has_add_permission(self, request, obj=None):
        # Rows are created automatically for every size (see signals.py) —
        # the owner only ever edits quantity, never adds/removes a size.
        return False


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'code', 'name', 'category', 'collection_name', 'price_display',
        'total_stock', 'stock_flag', 'status', 'is_featured', 'is_new',
    )
    list_filter = ('status', 'category', 'collection', 'is_featured', 'is_new')
    search_fields = ('name', 'sku', 'code')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ProductImageInline, ProductDetailInline, InventoryInline]
    autocomplete_fields = ('category', 'collection')
    actions = ['mark_active', 'mark_archived', 'mark_sold_out', 'mark_featured', 'unmark_featured', 'mark_new', 'unmark_new']

    fieldsets = (
        ('Identity', {'fields': ('name', 'slug', 'code', 'sku', 'color')}),
        ('Merchandising', {'fields': ('category', 'collection', 'status', 'drop_at', 'bot_product_id', 'is_featured', 'is_new', 'sold_out_override')}),
        ('Pricing', {'fields': ('price', 'sale_price')}),
        ('Copy', {'fields': ('description', 'fit_description', 'measurements', 'shipping_note')}),
        ('Showroom rail', {
            'fields': ('cutout_front', 'cutout_back'),
            'description': 'Garment cut out on a transparent background. With a front cut-out the product hangs on the homepage rail.',
        }),
    )

    def collection_name(self, obj):
        return obj.collection.name if obj.collection else '—'
    collection_name.short_description = 'Collection'

    def price_display(self, obj):
        if obj.sale_price is not None:
            return format_html('<s style="color:#999">{}</s> {} {}', obj.price, obj.sale_price, settings.SHOP_CURRENCY)
        return f'{obj.price} {settings.SHOP_CURRENCY}'
    price_display.short_description = 'Price'

    def total_stock(self, obj):
        return obj.total_stock
    total_stock.short_description = 'Stock'

    def stock_flag(self, obj):
        if obj.is_sold_out:
            return format_html('<span style="color:#b23c3c;font-weight:600;">SOLD OUT</span>')
        if obj.is_low_stock:
            return format_html('<span style="color:#b8860b;font-weight:600;">LOW</span>')
        return format_html('<span style="color:#2e7d32;">OK</span>')
    stock_flag.short_description = 'Status'

    @admin.action(description='Mark selected products as ACTIVE')
    def mark_active(self, request, queryset):
        updated = queryset.update(status='active')
        self.message_user(request, f'{updated} product(s) marked active.', messages.SUCCESS)

    @admin.action(description='Mark selected products as ARCHIVED')
    def mark_archived(self, request, queryset):
        updated = queryset.update(status='archived')
        self.message_user(request, f'{updated} product(s) archived.', messages.SUCCESS)

    @admin.action(description='Mark selected products as SOLD OUT')
    def mark_sold_out(self, request, queryset):
        updated = queryset.update(sold_out_override=True)
        self.message_user(request, f'{updated} product(s) marked sold out.', messages.SUCCESS)

    @admin.action(description='Mark selected products as FEATURED')
    def mark_featured(self, request, queryset):
        queryset.update(is_featured=True)

    @admin.action(description='Remove FEATURED from selected products')
    def unmark_featured(self, request, queryset):
        queryset.update(is_featured=False)

    @admin.action(description='Mark selected products as NEW ARRIVAL')
    def mark_new(self, request, queryset):
        queryset.update(is_new=True)

    @admin.action(description='Remove NEW ARRIVAL from selected products')
    def unmark_new(self, request, queryset):
        queryset.update(is_new=False)
