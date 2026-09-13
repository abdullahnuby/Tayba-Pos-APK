import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { openNumericPad } from '@/components/numeric-pad'

type Props = {
  managerDialog: boolean
  saveSalePending: boolean
  setManagerDialog: (v: boolean) => void
  managerUsername: string
  setManagerUsername: (v: string) => void
  managerPin: string
  setManagerPin: (v: string) => void
  pendingSalePayload: Record<string, unknown> | null
  setPendingSalePayload: (v: Record<string, unknown> | null) => void
  approveAndRetry: () => void
}

export function ManagerApprovalDialog({ managerDialog, saveSalePending, setManagerDialog, managerUsername, setManagerUsername, managerPin, setManagerPin, pendingSalePayload, setPendingSalePayload, approveAndRetry }: Props) {
  return (
      <Dialog
        open={managerDialog}
        onOpenChange={v => {
          if (!saveSalePending) {
            setManagerDialog(v)
            if (!v) {
              setManagerUsername('')
              setManagerPin('')
              setPendingSalePayload(null)
            }
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>موافقة المدير مطلوبة</DialogTitle>
            <DialogDescription>
              السعر خارج حدود الكاشير. استخدم اسم المدير وPIN من 4 أرقام للموافقة على الفاتورة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label>اسم مستخدم المدير</Label>
              <Input value={managerUsername} onChange={e => setManagerUsername(e.target.value)} dir="ltr" autoFocus />
            </div>

            <div>
              <Label>PIN المدير</Label>
              <button
                type="button"
                onClick={() =>
                  openNumericPad({
                    value: managerPin,
                    title: 'PIN المدير — 4 أرقام',
                    decimal: false,
                    maxLength: 4,
                    password: true,
                    onCommit: setManagerPin,
                  })
                }
                className="flex h-14 w-full items-center justify-center rounded-2xl border bg-background text-xl font-black tracking-[0.55em]"
              >
                {managerPin ? '•'.repeat(managerPin.length) : 'أدخل PIN من 4 أرقام'}
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setManagerDialog(false)
                setManagerUsername('')
                setManagerPin('')
                setPendingSalePayload(null)
              }}
              disabled={saveSalePending}
            >
              إلغاء
            </Button>
            <Button
              onClick={approveAndRetry}
              disabled={saveSalePending || !managerUsername.trim() || managerPin.length !== 4 || !pendingSalePayload}
            >
              {saveSalePending ? 'جارٍ التحقق...' : 'تأكيد الموافقة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}
