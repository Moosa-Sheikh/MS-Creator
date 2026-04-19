import { useParams, useLocation, Link } from "wouter";
import { AppLayout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useGetProduct,
  useGetProductStats,
  useListSessions,
  useListTemplates,
  useCreateSession,
  useDeleteProduct,
  getGetProductQueryKey,
  getGetProductStatsQueryKey,
  getListSessionsQueryKey,
  getListTemplatesQueryKey,
} from "@workspace/api-client-react";
import { Loader2, Plus, ChevronLeft, Trash2, Clock, ImageIcon, Layers } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  prompt_ready: "bg-blue-100 text-blue-700",
  generating: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: product, isLoading: productLoading } = useGetProduct(id!, {
    query: { enabled: !!id, queryKey: getGetProductQueryKey(id!) },
  });
  const { data: stats } = useGetProductStats(id!, {
    query: { enabled: !!id, queryKey: getGetProductStatsQueryKey(id!) },
  });
  const { data: sessions, isLoading: sessionsLoading } = useListSessions(
    { productId: id! },
    { query: { enabled: !!id, queryKey: getListSessionsQueryKey({ productId: id! }) } }
  );
  const { data: templates, isLoading: templatesLoading } = useListTemplates(
    { productId: id! },
    { query: { enabled: !!id, queryKey: getListTemplatesQueryKey({ productId: id! }) } }
  );

  const createSession = useCreateSession({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey({ productId: id! }) });
        setLocation(`/session/${data.id}`);
      },
      onError: () => {
        toast({ title: "Failed to create session", variant: "destructive" });
      },
    },
  });

  const deleteProduct = useDeleteProduct({
    mutation: {
      onSuccess: () => {
        setLocation("/");
        toast({ title: "Product deleted" });
      },
    },
  });

  const handleStartSession = () => {
    createSession.mutate({
      data: {
        productId: id!,
        optionType: "A",
        outputType: "M1",
        productImageUrls: [],
      },
    });
  };

  if (productLoading) {
    return (
      <AppLayout>
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!product) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-lg font-semibold">Product not found</h2>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              Back to Products
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
              {product.description && (
                <p className="text-muted-foreground mt-1">{product.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={handleStartSession} disabled={createSession.isPending}>
              {createSession.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              New Mockup Session
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Product</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{product.name}" and all its sessions and templates.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteProduct.mutate({ id: id! })}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold">{stats.sessionCount}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Sessions</div>
            </div>
            <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold">{stats.completedSessionCount}</div>
              <div className="text-sm text-muted-foreground mt-1">Completed</div>
            </div>
            <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold">{stats.templateCount}</div>
              <div className="text-sm text-muted-foreground mt-1">Templates</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                Recent Sessions
              </h2>
              <Button variant="ghost" size="sm" onClick={handleStartSession} disabled={createSession.isPending}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                New
              </Button>
            </div>
            {sessionsLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !sessions?.length ? (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No sessions yet. Start a new mockup session.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <Link key={session.id} href={`/session/${session.id}`}>
                    <div className="flex items-center justify-between p-4 bg-card border border-border/50 rounded-xl hover:border-primary/20 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-mono font-bold text-muted-foreground">
                          {session.optionType}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">Option {session.optionType} / {session.outputType}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[session.status] || STATUS_COLORS.draft}`}>
                              {session.status.replace("_", " ")}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(session.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {session.generatedImageUrls?.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>{session.generatedImageUrls.length}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              Templates
            </h2>
            {templatesLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !templates?.length ? (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No templates yet. Complete a session and save it as a template.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="bg-card border border-border/50 rounded-xl overflow-hidden group">
                    {tpl.imageUrls?.[0] ? (
                      <div className="aspect-square bg-muted overflow-hidden">
                        <img
                          src={`/api/storage${tpl.imageUrls[0]}`}
                          alt={tpl.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-muted flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="font-medium text-sm truncate">{tpl.name}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="secondary" className="text-xs">{tpl.type}</Badge>
                        <Badge variant="secondary" className="text-xs">Option {tpl.optionType}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
