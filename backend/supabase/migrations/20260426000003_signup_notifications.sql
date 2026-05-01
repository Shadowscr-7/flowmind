-- Records signup notification delivery so the registration flow does not email duplicates.

CREATE TABLE IF NOT EXISTS public.signup_notifications (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email TEXT NOT NULL,
  display_name TEXT,
  phone TEXT,
  plan TEXT,
  source TEXT
);

ALTER TABLE public.signup_notifications ENABLE ROW LEVEL SECURITY;
