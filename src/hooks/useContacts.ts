import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Contact, ContactFilters } from "@/types";

const DEFAULT_PAGE_SIZE = 50;

async function fetchContacts(filters: ContactFilters, page: number, pageSize: number) {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("contacts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.search) {
    query = query.or(
      `azienda.ilike.%${filters.search}%,nome.ilike.%${filters.search}%,email.ilike.%${filters.search}%,telefono.ilike.%${filters.search}%`
    );
  }
  if (filters.stato?.length) query = query.in("stato", filters.stato);
  if (filters.fonte?.length) query = query.in("fonte", filters.fonte);
  if (filters.citta?.length) query = query.in("citta", filters.citta);
  if (filters.hasEmail) query = query.not("email", "is", null);
  if (filters.hasTelefono) query = query.not("telefono", "is", null);
  if (filters.tags?.length) query = query.overlaps("tags", filters.tags);

  const { data, count, error } = await query;
  if (error) throw error;
  return { contacts: (data as Contact[]) || [], totalCount: count || 0 };
}

export function useContacts(filters: ContactFilters, page = 0, pageSize = DEFAULT_PAGE_SIZE) {
  const query = useQuery({
    queryKey: ["contacts", filters, page, pageSize],
    queryFn: () => fetchContacts(filters, page, pageSize),
    staleTime: 30_000,
  });

  const totalPages = Math.ceil((query.data?.totalCount || 0) / pageSize);

  return {
    contacts: query.data?.contacts || [],
    totalCount: query.data?.totalCount || 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
    totalPages,
    pageSize,
  };
}
