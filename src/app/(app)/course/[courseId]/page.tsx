"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { courseServers, units as unitsApi, documents as documentsApi, groups as groupsApi } from "@/lib/api";
import type { ApiCourseServer, ApiUnit, ApiDocument, ApiGroup } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useAppContext } from "@/hooks/useAppContext";
import { useToast } from "@/hooks/use-toast";

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const { currentUser } = useAppContext();
  const { toast } = useToast();

  const [server, setServer] = useState<ApiCourseServer | null>(null);
  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [documents, setDocuments] = useState<{ [unitId: number]: ApiDocument[] }>({});
  const [groups, setGroups] = useState<{ [unitId: number]: ApiGroup[] }>({});
  const [isLoading, setIsLoading] = useState(true);

  // Add unit form state
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitName, setUnitName] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [unitDescription, setUnitDescription] = useState("");
  const [unitCredits, setUnitCredits] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingUnitId, setDeletingUnitId] = useState<number | null>(null);

  const isClassRep = server && currentUser && server.class_rep_id === currentUser.id;

  useEffect(() => {
    if (!courseId) return;

    const loadData = async () => {
      try {
        const { course_server } = await courseServers.get(Number(courseId));
        setServer(course_server);

        const courseUnits = course_server.units ?? [];
        setUnits(courseUnits);

        const docsByUnit: { [unitId: number]: ApiDocument[] } = {};
        const groupsByUnit: { [unitId: number]: ApiGroup[] } = {};

        await Promise.all(
          courseUnits.map(async (unit) => {
            const [docsRes, groupsRes] = await Promise.all([
              documentsApi.list(unit.id),
              groupsApi.list(unit.id),
            ]);
            docsByUnit[unit.id] = docsRes.documents;
            groupsByUnit[unit.id] = groupsRes.groups;
          })
        );

        setDocuments(docsByUnit);
        setGroups(groupsByUnit);
      } catch (error) {
        console.error("Failed to load course data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [courseId]);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server || !unitName.trim() || !unitCode.trim()) return;

    setIsSubmitting(true);
    try {
      const { unit } = await unitsApi.create(server.id, {
        name: unitName.trim(),
        unit_code: unitCode.trim(),
        description: unitDescription.trim() || undefined,
        credits: unitCredits ? Number(unitCredits) : undefined,
      });
      setUnits(prev => [...prev, unit]);
      setDocuments(prev => ({ ...prev, [unit.id]: [] }));
      setGroups(prev => ({ ...prev, [unit.id]: [] }));
      setUnitName("");
      setUnitCode("");
      setUnitDescription("");
      setUnitCredits("");
      setShowAddUnit(false);
      toast({ title: "Unit added", description: `${unit.unit_code} — ${unit.name}` });
    } catch (err: any) {
      toast({ title: "Failed to add unit", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unitId: number) => {
    setDeletingUnitId(unitId);
    try {
      await unitsApi.delete(unitId);
      setUnits(prev => prev.filter(u => u.id !== unitId));
      toast({ title: "Unit deleted" });
    } catch (err: any) {
      toast({ title: "Failed to delete unit", description: err.message, variant: "destructive" });
    } finally {
      setDeletingUnitId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Course server not found.
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{server.name}</CardTitle>
          {server.description && <CardDescription>{server.description}</CardDescription>}
        </CardHeader>
      </Card>

      {/* Units section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Course Units</h2>
        {isClassRep && (
          <Button
            size="sm"
            onClick={() => setShowAddUnit(v => !v)}
            variant={showAddUnit ? "outline" : "default"}
          >
            {showAddUnit ? (
              <><X className="h-4 w-4 mr-1" /> Cancel</>
            ) : (
              <><Plus className="h-4 w-4 mr-1" /> Add Unit</>
            )}
          </Button>
        )}
      </div>

      {/* Add unit form */}
      {isClassRep && showAddUnit && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddUnit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="unit-name">Unit Name *</Label>
                  <Input
                    id="unit-name"
                    value={unitName}
                    onChange={e => setUnitName(e.target.value)}
                    placeholder="e.g. Introduction to Programming"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit-code">Unit Code *</Label>
                  <Input
                    id="unit-code"
                    value={unitCode}
                    onChange={e => setUnitCode(e.target.value)}
                    placeholder="e.g. CS101"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="unit-desc">Description</Label>
                  <Input
                    id="unit-desc"
                    value={unitDescription}
                    onChange={e => setUnitDescription(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit-credits">Credits</Label>
                  <Input
                    id="unit-credits"
                    type="number"
                    min="1"
                    max="30"
                    value={unitCredits}
                    onChange={e => setUnitCredits(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</> : "Add Unit"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {units.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          {isClassRep ? 'No units yet. Use "Add Unit" to create one.' : 'No units yet.'}
        </p>
      )}

      {units.map((unit) => (
        <Card key={unit.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>{unit.name}</CardTitle>
                <CardDescription>{unit.unit_code}{unit.credits ? ` · ${unit.credits} credits` : ''}</CardDescription>
              </div>
              {isClassRep && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => handleDeleteUnit(unit.id)}
                  disabled={deletingUnitId === unit.id}
                  title="Delete unit"
                >
                  {deletingUnitId === unit.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Documents */}
            <div>
              <h3 className="text-base font-semibold mb-3">Documents</h3>
              {(documents[unit.id] ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(documents[unit.id] ?? []).map((doc) => (
                    <Card key={doc.id} className="p-4">
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{doc.document_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Groups */}
            <div>
              <h3 className="text-base font-semibold mb-3">Assignment Groups</h3>
              {(groups[unit.id] ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No groups set up yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(groups[unit.id] ?? []).map((group) => (
                    <Card key={group.id} className="p-4">
                      <p className="font-medium text-sm">{group.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {group.members_count ?? group.members?.length ?? 0} / {group.max_size} members
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
