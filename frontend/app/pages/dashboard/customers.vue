<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { upperFirst } from "scule";
import { getPaginationRowModel } from "@tanstack/table-core";
import type { Row } from "@tanstack/table-core";
import type { User } from "~/types";

definePageMeta({
  middleware: "auth",
});

const { t } = useI18n();

const UAvatar = resolveComponent("UAvatar");
const UButton = resolveComponent("UButton");
const UBadge = resolveComponent("UBadge");
const UDropdownMenu = resolveComponent("UDropdownMenu");
const UCheckbox = resolveComponent("UCheckbox");

const toast = useToast();
const table = useTemplateRef("table");

const columnFilters = ref([
  {
    id: "email",
    value: "",
  },
]);
const columnVisibility = ref();
const rowSelection = ref({ 1: true });

const { data, status } = await useFetch<User[]>("/api/customers", {
  lazy: true,
});

function getRowItems(row: Row<User>) {
  return [
    {
      type: "label",
      label: t('common.labels.actions'),
    },
    {
      label: t('pages.dashboard.customers.copyCustomerId'),
      icon: "i-lucide-copy",
      onSelect() {
        navigator.clipboard.writeText(row.original.id.toString());
        toast.add({
          title: t('common.messages.copiedToClipboard'),
          description: t('pages.dashboard.customers.customerIdCopied'),
        });
      },
    },
    {
      type: "separator",
    },
    {
      label: t('pages.dashboard.customers.viewCustomerDetails'),
      icon: "i-lucide-list",
    },
    {
      label: t('pages.dashboard.customers.viewCustomerPayments'),
      icon: "i-lucide-wallet",
    },
    {
      type: "separator",
    },
    {
      label: t('pages.dashboard.customers.deleteCustomer'),
      icon: "i-lucide-trash",
      color: "error",
      onSelect() {
        toast.add({
          title: t('pages.dashboard.customers.customerDeleted'),
          description: t('pages.dashboard.customers.customerDeletedDescription'),
        });
      },
    },
  ];
}

const columns: TableColumn<User>[] = [
  {
    id: "select",
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? "indeterminate"
          : table.getIsAllPageRowsSelected(),
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          table.toggleAllPageRowsSelected(!!value),
        ariaLabel: "Select all",
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          row.toggleSelected(!!value),
        ariaLabel: "Select row",
      }),
  },
  {
    accessorKey: "id",
    header: t('common.labels.id'),
  },
  {
    accessorKey: "name",
    header: t('common.labels.name'),
    cell: ({ row }) => {
      return h("div", { class: "flex items-center gap-3" }, [
        h(UAvatar, {
          ...row.original.avatar,
          size: "lg",
        }),
        h("div", undefined, [
          h("p", { class: "font-medium text-highlighted" }, row.original.name),
          h("p", { class: "" }, `@${row.original.name}`),
        ]),
      ]);
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();

      return h(UButton, {
        color: "neutral",
        variant: "ghost",
        label: t('common.labels.email'),
        icon: isSorted
          ? isSorted === "asc"
            ? "i-lucide-arrow-up-narrow-wide"
            : "i-lucide-arrow-down-wide-narrow"
          : "i-lucide-arrow-up-down",
        class: "-mx-2.5",
        onClick: () => column.toggleSorting(column.getIsSorted() === "asc"),
      });
    },
  },
  {
    accessorKey: "location",
    header: t('common.labels.location'),
    cell: ({ row }) => row.original.location,
  },
  {
    accessorKey: "status",
    header: t('components.home.tableHeaders.status'),
    filterFn: "equals",
    cell: ({ row }) => {
      const status = row.original.status;
      const color = {
        subscribed: "success" as const,
        unsubscribed: "error" as const,
        bounced: "warning" as const,
      }[status];

      return h(
        UBadge,
        { class: "capitalize", variant: "subtle", color },
        () => t(`common.status.${status}`),
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return h(
        "div",
        { class: "text-right" },
        h(
          UDropdownMenu,
          {
            content: {
              align: "end",
            },
            items: getRowItems(row),
          },
          () =>
            h(UButton, {
              icon: "i-lucide-ellipsis-vertical",
              color: "neutral",
              variant: "ghost",
              class: "ml-auto",
            }),
        ),
      );
    },
  },
];

const statusFilter = ref("all");

watch(
  () => statusFilter.value,
  (newVal) => {
    if (!table?.value?.tableApi) return;

    const statusColumn = table.value.tableApi.getColumn("status");
    if (!statusColumn) return;

    if (newVal === "all") {
      statusColumn.setFilterValue(undefined);
    } else {
      statusColumn.setFilterValue(newVal);
    }
  },
);

const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
});
</script>

<template>
  <UDashboardPanel id="customers">
    <template #header>
      <UDashboardNavbar :title="t('pages.dashboard.customers.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <CustomersAddModal />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          :model-value="
            table?.tableApi?.getColumn('email')?.getFilterValue() as string
          "
          class="max-w-sm"
          icon="i-lucide-search"
          :placeholder="t('common.placeholders.filterEmails')"
          @update:model-value="
            table?.tableApi?.getColumn('email')?.setFilterValue($event)
          "
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <CustomersDeleteModal
            :count="table?.tableApi?.getFilteredSelectedRowModel().rows.length"
          >
            <UButton
              v-if="table?.tableApi?.getFilteredSelectedRowModel().rows.length"
              :label="t('pages.dashboard.customers.deleteSelected')"
              color="error"
              variant="subtle"
              icon="i-lucide-trash"
            >
              <template #trailing>
                <UKbd>
                  {{
                    table?.tableApi?.getFilteredSelectedRowModel().rows.length
                  }}
                </UKbd>
              </template>
            </UButton>
          </CustomersDeleteModal>

          <USelect
            v-model="statusFilter"
            :items="[
              { label: t('pages.dashboard.customers.all'), value: 'all' },
              { label: t('common.status.subscribed'), value: 'subscribed' },
              { label: t('common.status.unsubscribed'), value: 'unsubscribed' },
              { label: t('common.status.bounced'), value: 'bounced' },
            ]"
            :ui="{
              trailingIcon:
                'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }"
            :placeholder="t('pages.dashboard.customers.filterStatus')"
            class="min-w-28"
          />
          <UDropdownMenu
            :items="
              table?.tableApi
                ?.getAllColumns()
                .filter((column: any) => column.getCanHide())
                .map((column: any) => ({
                  label: upperFirst(column.id),
                  type: 'checkbox' as const,
                  checked: column.getIsVisible(),
                  onUpdateChecked(checked: boolean) {
                    table?.tableApi
                      ?.getColumn(column.id)
                      ?.toggleVisibility(!!checked);
                  },
                  onSelect(e?: Event) {
                    e?.preventDefault();
                  },
                }))
            "
            :content="{ align: 'end' }"
          >
            <UButton
              :label="t('common.buttons.display')"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-settings-2"
            />
          </UDropdownMenu>
        </div>
      </div>

      <UTable
        ref="table"
        v-model:column-filters="columnFilters"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        v-model:pagination="pagination"
        :pagination-options="{
          getPaginationRowModel: getPaginationRowModel(),
        }"
        class="shrink-0"
        :data="data"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0',
        }"
      />

      <div
        class="border-default mt-auto flex items-center justify-between gap-3 border-t pt-4"
      >
        <div class="text-muted text-sm">
          {{ t('common.messages.rowsSelected', {
            count: table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0,
            total: table?.tableApi?.getFilteredRowModel().rows.length || 0
          }) }}
        </div>

        <div class="flex items-center gap-1.5">
          <UPagination
            :default-page="
              (table?.tableApi?.getState().pagination.pageIndex || 0) + 1
            "
            :items-per-page="table?.tableApi?.getState().pagination.pageSize"
            :total="table?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
