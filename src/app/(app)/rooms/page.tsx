'use client';

import { useState, useEffect, useCallback } from "react";
import { units as unitsApi, courseServers as courseServersApi, type ApiUnit, type ApiCourseServer } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookCopy, Server, Plus, Hash, Crown, Loader2, Trash2, X } from "lucide-react";
import { useAppContext } from "@/hooks/useAppContext";
import { useToast } from "@/hooks/use-toast";
import CreateServerDialog from "@/components/CreateServerDialog";
import JoinServerDialog from "@/components/JoinServerDialog";

const colorClasses = [
  "bg-red-500", "bg-pink-500", "bg-purple-500", "bg-indigo-500",
  "bg-blue-500", "bg-cyan-500", "bg-teal-500", "bg-green-500",
  "bg-lime-500", "bg-yellow-500", "bg-amber-500", "bg-orange-500",
  "bg-rose-500", "bg-fuchsia-500", "bg-violet-500", "bg-sky-500",
  "bg-emerald-500",
];

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

function getColorClass(name: string): string {
  return colorClasses[Math.abs(hashCode(name)) % colorClasses.length];
}

interface AddUnitFormState {
  name: string;
  unit_code: string;
  description: string;
  credits: string;
}

export default function AllUnitsPage() {
  const { currentUser } = useAppContext();
  const { toast } = useToast();

  const [servers, setServers] = useState<ApiCourseServer[]>([]);
  const [allUnits, setAllUnits] = useState<ApiUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Add unit form
  const [addingForServer, setAddingForServer] = useState<number | null>(null);
  const [form, setForm] = useState<AddUnitFormState>({ name: '', unit_code: '', description: '', credits: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation dialog state
  const [confirm, setConfirm] = useState<{
    type: 'delete-server' | 'delete-unit';
    id: number;
    label: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const serverRes = await courseServersApi.list();
      setServers(serverRes.course_servers);
    } catch (e) {
      console.error('Failed to load servers:', e);
    }
    try {
      const unitRes = await unitsApi.list();
      setAllUnits(unitRes.units);
    } catch (e) {
      console.error('Failed to load units:', e);
    }
    setIsLoading(false);
  }, [currentUser]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreated = (server: ApiCourseServer) => {
    setServers((prev) => [server, ...prev]);
  };

  const handleJoined = (server: ApiCourseServer) => {
    setServers((prev) => {
      if (prev.some((s) => s.id === server.id)) return prev;
      return [server, ...prev];
    });
  };

  const openAddUnit = (serverId: number) => {
    setAddingForServer(serverId);
    setForm({ name: '', unit_code: '', description: '', credits: '' });
  };

  const closeAddUnit = () => {
    setAddingForServer(null);
    setForm({ name: '', unit_code: '', description: '', credits: '' });
  };

  const handleAddUnit = async (e: React.FormEvent, serverId: number) => {
    e.preventDefault();
    if (!form.name.trim() || !form.unit_code.trim()) return;
    setIsSubmitting(true);
    try {
      const { unit } = await unitsApi.create(serverId, {
        name: form.name.trim(),
        unit_code: form.unit_code.trim(),
        description: form.description.trim() || undefined,
        credits: form.credits ? Number(form.credits) : undefined,
      });
      setAllUnits(prev => [...prev, unit]);
      closeAddUnit();
      toast({ title: "Unit added", description: `${unit.unit_code} — ${unit.name}` });
    } catch (err: any) {
      toast({ title: "Failed to add unit", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirm) return;
    setIsDeleting(true);
    try {
      if (confirm.type === 'delete-server') {
        await courseServersApi.delete(confirm.id);
        setServers(prev => prev.filter(s => s.id !== confirm.id));
        setAllUnits(prev => prev.filter(u => u.course_server_id !== confirm.id));
        toast({ title: "Server deleted", description: `"${confirm.label}" has been deleted.` });
      } else {
        await unitsApi.delete(confirm.id);
        setAllUnits(prev => prev.filter(u => u.id !== confirm.id));
        toast({ title: "Unit deleted", description: `"${confirm.label}" has been deleted.` });
      }
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  const unitsByServer = servers.map((server) => ({
    server,
    units: allUnits.filter((u) => u.course_server_id === server.id),
    isAdmin: String(server.class_rep_id) === String(currentUser?.id),
  }));

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold font-headline text-primary flex items-center">
            <BookCopy className="mr-3 h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0" /> Browse Units
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-2">
            All units across your enrolled course servers.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span>Create Server</span>
          </Button>
          <Button variant="outline" onClick={() => setShowJoin(true)} className="gap-2">
            <Hash className="h-4 w-4" />
            <span>Join Server</span>
          </Button>
        </div>
      </header>

      {unitsByServer.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Server className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-xl text-foreground font-semibold mb-2">No course servers yet</p>
            <p className="text-sm text-muted-foreground mb-6">
              Create a course server to get started, or join one with a code.
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Create Server
              </Button>
              <Button onClick={() => setShowJoin(true)} variant="outline" className="gap-2">
                <Hash className="h-4 w-4" /> Join with Code
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {unitsByServer.map(({ server, units, isAdmin: isServerAdmin }) => {
            const isAddingHere = addingForServer === server.id;

            return (
              <section key={server.id}>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <Server className="h-5 w-5 text-primary flex-shrink-0" />
                  <h2 className="text-xl font-semibold font-headline">{server.name}</h2>
                  <Badge variant="secondary" className="font-mono text-xs">{server.code}</Badge>
                  {isServerAdmin && (
                    <Badge className="gap-1 text-xs">
                      <Crown className="h-3 w-3" /> Admin
                    </Badge>
                  )}
                  {isServerAdmin && (
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isAddingHere ? "outline" : "secondary"}
                        className="gap-1.5 h-7 text-xs"
                        onClick={() => isAddingHere ? closeAddUnit() : openAddUnit(server.id)}
                      >
                        {isAddingHere ? (
                          <><X className="h-3 w-3" /> Cancel</>
                        ) : (
                          <><Plus className="h-3 w-3" /> Add Unit</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirm({ type: 'delete-server', id: server.id, label: server.name })}
                      >
                        <Trash2 className="h-3 w-3" /> Delete Server
                      </Button>
                    </div>
                  )}
                </div>

                {/* Add unit form */}
                {isServerAdmin && isAddingHere && (
                  <div className="mb-4 ml-0 sm:ml-8">
                    <Card className="border-primary/30">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm">New Unit</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <form onSubmit={(e) => handleAddUnit(e, server.id)} className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor={`name-${server.id}`} className="text-xs">Unit Name *</Label>
                              <Input
                                id={`name-${server.id}`}
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Introduction to Programming"
                                className="h-8 text-sm"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`code-${server.id}`} className="text-xs">Unit Code *</Label>
                              <Input
                                id={`code-${server.id}`}
                                value={form.unit_code}
                                onChange={e => setForm(f => ({ ...f, unit_code: e.target.value }))}
                                placeholder="e.g. CS101"
                                className="h-8 text-sm"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`desc-${server.id}`} className="text-xs">Description</Label>
                              <Input
                                id={`desc-${server.id}`}
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Optional"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`credits-${server.id}`} className="text-xs">Credits</Label>
                              <Input
                                id={`credits-${server.id}`}
                                type="number"
                                min="1"
                                max="30"
                                value={form.credits}
                                onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}
                                placeholder="Optional"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button type="submit" size="sm" disabled={isSubmitting}>
                              {isSubmitting ? (
                                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Adding...</>
                              ) : "Add Unit"}
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {units.length === 0 ? (
                  <p className="text-sm text-muted-foreground ml-8">
                    {isServerAdmin ? 'No units yet. Click "Add Unit" to create one.' : 'No units in this server yet.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 ml-0 sm:ml-8">
                    {units.map((unit) => (
                      <div key={unit.id} className="relative group">
                        <Link href={`/rooms/${server.id}/${unit.id}`} className="block">
                          <Card
                            className={`h-36 ${getColorClass(unit.name)} text-white rounded-lg overflow-hidden relative transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl`}
                          >
                            <CardHeader className="p-3 relative z-10">
                              <CardTitle className="text-sm font-semibold leading-tight" title={unit.name}>
                                {unit.name}
                              </CardTitle>
                              {unit.unit_code && (
                                <CardDescription className="text-xs text-white/80">
                                  {unit.unit_code}
                                </CardDescription>
                              )}
                            </CardHeader>
                          </Card>
                        </Link>
                        {isServerAdmin && (
                          <button
                            onClick={() => setConfirm({ type: 'delete-unit', id: unit.id, label: unit.name })}
                            className="absolute top-2 right-2 z-20 bg-black/40 hover:bg-red-600 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete unit"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <CreateServerDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
      />
      <JoinServerDialog
        open={showJoin}
        onOpenChange={setShowJoin}
        onJoined={handleJoined}
      />

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirm} onOpenChange={(open) => { if (!open && !isDeleting) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === 'delete-server' ? 'Delete course server?' : 'Delete unit?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'delete-server'
                ? `Are you sure you want to delete "${confirm?.label}"? This will permanently remove the server and all its units, messages, and documents. This cannot be undone.`
                : `Are you sure you want to delete "${confirm?.label}"? All messages, documents, and groups in this unit will be permanently removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : 'Yes, delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
