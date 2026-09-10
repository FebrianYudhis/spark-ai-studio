import Swal from 'sweetalert2';

// Toast Notification Mixin
export const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
  customClass: {
    popup: 'rounded-xl text-sm shadow-xl border border-slate-200 !font-sans',
  },
});

export const showToast = (
  title: string,
  icon: 'success' | 'error' | 'warning' | 'info' = 'success'
) => {
  return Toast.fire({
    icon,
    title,
  });
};

export const showSuccess = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    confirmButtonColor: '#4f46e5',
    confirmButtonText: 'Tutup',
    customClass: {
      popup: 'rounded-2xl !font-sans shadow-2xl border border-slate-200',
      confirmButton: 'px-5 py-2.5 rounded-xl font-medium text-sm text-white shadow-sm cursor-pointer',
    },
  });
};

export const showError = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonColor: '#e11d48',
    confirmButtonText: 'Tutup',
    customClass: {
      popup: 'rounded-2xl !font-sans shadow-2xl border border-slate-200',
      confirmButton: 'px-5 py-2.5 rounded-xl font-medium text-sm text-white shadow-sm cursor-pointer',
    },
  });
};

export const showConfirm = async ({
  title,
  text,
  confirmButtonText = 'Ya, Lanjutkan',
  cancelButtonText = 'Batal',
  isDanger = false,
}: {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  isDanger?: boolean;
}): Promise<boolean> => {
  const result = await Swal.fire({
    title,
    text,
    icon: isDanger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonColor: isDanger ? '#e11d48' : '#4f46e5',
    cancelButtonColor: '#64748b',
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    focusCancel: isDanger,
    customClass: {
      popup: 'rounded-2xl !font-sans shadow-2xl border border-slate-200',
      confirmButton: 'px-5 py-2.5 rounded-xl font-medium text-sm text-white shadow-sm',
      cancelButton: 'px-5 py-2.5 rounded-xl font-medium text-sm text-white shadow-sm mr-2',
    },
  });

  return result.isConfirmed;
};

export default Swal;
