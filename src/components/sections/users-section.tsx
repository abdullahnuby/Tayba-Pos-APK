'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { UserPlus, Trash2, Users as UsersIcon, Hash } from 'lucide-react'
import { toast } from 'sonner'
import { openNumericPad } from '@/components/numeric-pad'

interface AppUser {
  id: string
  username: string
  name: string
  role: 'admin' | 'manager' | 'cashier'
  active: boolean
  createdAt?: string
  hasPin?: boolean
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'مدير عام',
  manager: 'محاسب',
  cashier: 'كاشير',
}

export function UsersSection() {
  const qc = useQueryClient()
  const { data: usersData, isLoading } = useQuery<AppUser[] | { items?: AppUser[] }>({
    queryKey: ['users'],
    queryFn: async () => (await fetch('/api/users')).json(),
  })

  const data: AppUser[] = Array.isArray(usersData) ? usersData : (Array.isArray((usersData as any)?.items) ? (usersData as any).items as AppUser[] : [])

  const [addOpen, setAddOpen] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', name: '', role: 'cashier', pin: '' })


  const [pinTarget, setPinTarget] = useState<AppUser | null>(null)
  const [pinValue, setPinValue] = useState('')

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'فشل إنشاء المستخدم')
      return body
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('تم إنشاء المستخدم — الدخول باسم المستخدم وPIN من 4 أرقام')
      setAddOpen(false)
      setNewUser({ username: '', name: '', role: 'cashier', pin: '' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const patchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'فشل التعديل')
      return body
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'فشل الحذف')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('تم حذف المستخدم')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submitPin() {
    if (!pinTarget) return
    if (!/^\d{4}$/.test(pinValue)) {
      toast.error('الـPIN لازم يكون 4 أرقام بالضبط')
      return
    }
    patchMutation.mutate(
      { id: pinTarget.id, data: { pin: pinValue } },
      {
        onSuccess: () => {
          toast.success('تم تحديد الرقم السري للوردية')
          setPinTarget(null)
          setPinValue('')
        },
      }
    )
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UsersIcon className="size-6 text-primary" />
            المستخدمين
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة حسابات الدخول للنظام — اسم المستخدم وPIN من 4 أرقام والصلاحيات
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="size-4" />
              مستخدم جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إنشاء مستخدم جديد</DialogTitle>
              <DialogDescription>يسجل الدخول باسم المستخدم وPIN من 4 أرقام فقط</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input
                  value={newUser.name}
                  onChange={(e) => setNewUser((s) => ({ ...s, name: e.target.value }))}
                  placeholder="اسم الموظف"
                />
              </div>
              <div className="space-y-2">
                <Label>اسم المستخدم (للدخول)</Label>
                <Input
                  value={newUser.username}
                  onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))}
                  placeholder="username"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>PIN الدخول *</Label>
                <button type="button" className="flex h-14 w-full items-center justify-center rounded-2xl border bg-background text-xl font-black tracking-[0.55em]" onClick={() => openNumericPad({ value: newUser.pin, title: 'PIN المستخدم — 4 أرقام', decimal: false, maxLength: 4, password: true, onCommit: (pin) => setNewUser((s) => ({ ...s, pin })) })}>
                  {newUser.pin ? '•'.repeat(newUser.pin.length) : 'أدخل PIN من 4 أرقام'}
                </button>
              </div>
              <div className="space-y-2">
                <Label>الصلاحية</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(v) => setNewUser((s) => ({ ...s, role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">كاشير</SelectItem>
                    <SelectItem value="manager">محاسب</SelectItem>
                    <SelectItem value="admin">مدير عام</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newUser.username || !newUser.pin || !newUser.name}
              >
                إنشاء الحساب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">كل المستخدمين</CardTitle>
          <CardDescription>البيانات محفوظة محليًا على الجهاز وتتم مزامنتها لاحقًا</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">جاري التحميل...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>اسم المستخدم</TableHead>
                  <TableHead>الصلاحية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u: AppUser) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">{u.username}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) => patchMutation.mutate({ id: u.id, data: { role: v } })}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue>{ROLE_LABEL[u.role]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cashier">كاشير</SelectItem>
                          <SelectItem value="manager">محاسب</SelectItem>
                          <SelectItem value="admin">مدير عام</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.active}
                          onCheckedChange={(checked) =>
                            patchMutation.mutate({ id: u.id, data: { active: checked } })
                          }
                        />
                        <Badge variant={u.active ? 'default' : 'secondary'}>
                          {u.active ? 'مفعّل' : 'معطّل'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Dialog
                          open={pinTarget?.id === u.id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setPinTarget(null)
                              setPinValue('')
                            } else {
                              setPinTarget(u)
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={u.hasPin ? 'تغيير PIN الدخول' : 'تعيين PIN الدخول'}
                            >
                              <Hash className={`size-4 ${u.hasPin ? '' : 'text-destructive'}`} />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>تعديل PIN الدخول — {u.name}</DialogTitle>
                              <DialogDescription>
                                ده نفس PIN الدخول للمستخدم، ويُستخدم أيضًا لتأكيد فتح وإغلاق الوردية.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2 py-2">
                              <Label>PIN (4 أرقام بالضبط)</Label>
                              <button type="button" className="flex h-14 w-full items-center justify-center rounded-2xl border bg-background text-xl font-black tracking-[0.55em]" onClick={() => openNumericPad({ value: pinValue, title: 'PIN الجديد — 4 أرقام', decimal: false, maxLength: 4, password: true, onCommit: setPinValue })}>
                                {pinValue ? '•'.repeat(pinValue.length) : 'أدخل PIN من 4 أرقام'}
                              </button>
                            </div>
                            <DialogFooter>
                              <Button onClick={submitPin} disabled={patchMutation.isPending}>
                                حفظ
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="حذف المستخدم">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف {u.name}؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                الإجراء ده نهائي. لو عايز توقف دخوله بس، استخدم زر التعطيل بدل الحذف.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(u.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                حذف نهائي
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
