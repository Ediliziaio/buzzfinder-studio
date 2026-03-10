import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Contact, ContactFilters } from "@/types";

const DEFAULT_PAGE_SIZE = 50;

export function useContacts(filters: ContactFilters, pageSize = DEFAULT_PAGE_SIZE) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filters]);

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
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
      if (filters.stato?.length) {
        query = query.in("stato", filters.stato);
      }
      if (filters.fonte?.length) {
        query = query.in("fonte", filters.fonte);
      }
      if (filters.citta?.length) {
        query = query.in("citta", filters.citta);
      }
      if (filters.hasEmail) {
        query = query.not("email", "is", null);
      }
      if (filters.hasTelefono) {
        query = query.not("telefono", "is", null);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setContacts((data as Contact[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching contacts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    contacts,
    totalCount,
    isLoading,
    refetch: fetchContacts,
    page,
    setPage,
    totalPages,
    pageSize,
  };
}
