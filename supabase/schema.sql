-- Nodedistro Labs bootstrap schema. Apply to a new Supabase project after review.
-- The versioned document is the authoritative design. Domain tables are extension points.
begin;
create schema if not exists pcb_private;
revoke all on schema pcb_private from public;
grant usage on schema pcb_private to authenticated, anon;
create table public.pcb_profiles(id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', preferences jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.pcb_projects(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),document jsonb not null check(jsonb_typeof(document)='object'),revision integer not null default 0,is_public boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index pcb_projects_owner_idx on public.pcb_projects(owner_id);
create table public.pcb_project_members(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.pcb_projects(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null check(role in ('editor','commenter','viewer')),created_at timestamptz not null default now(),unique(project_id,user_id));
create index pcb_members_user_idx on public.pcb_project_members(user_id);
create table public.pcb_versions(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.pcb_projects(id) on delete cascade,author_id uuid not null references auth.users(id),name text not null,document jsonb not null,revision integer not null,created_at timestamptz not null default now());
create index pcb_versions_project_idx on public.pcb_versions(project_id,created_at desc);
create table public.pcb_version_changes(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.pcb_projects(id) on delete cascade,author_id uuid not null references auth.users(id),operation text not null,before_state jsonb not null,after_state jsonb not null,revision integer not null,created_at timestamptz not null default now());
create table public.pcb_comments(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.pcb_projects(id) on delete cascade,author_id uuid not null references auth.users(id),object_id text,parent_id uuid references public.pcb_comments(id),body text not null check(length(body) between 1 and 4000),resolved boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index pcb_comments_project_idx on public.pcb_comments(project_id,created_at);
create table public.pcb_ai_plans(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),prompt text not null,plan jsonb not null,approved boolean not null default false,created_at timestamptz not null default now());
create table public.pcb_ai_actions(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.pcb_projects(id),user_id uuid not null references auth.users(id),proposal jsonb not null,base_revision integer not null,status text not null default 'pending' check(status in ('pending','applied','rejected')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.pcb_invitations(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.pcb_projects(id),email text not null,role text not null check(role in ('viewer','commenter','editor')),created_by uuid not null references auth.users(id),token_hash text not null unique,accepted_by uuid references auth.users(id),expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now());
create table public.pcb_subscriptions(user_id uuid primary key references auth.users(id),customer_id text unique,subscription_id text unique,plan text not null default 'free' check(plan in ('free','pro','team')),status text not null default 'inactive',updated_at timestamptz not null default now());
create table public.pcb_usage(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),month date not null default date_trunc('month',now())::date,ai_requests integer not null default 0,ai_tokens bigint not null default 0,simulations integer not null default 0,exports integer not null default 0,unique(user_id,month));
create table public.pcb_webhook_events(id text primary key,created_at timestamptz not null default now());
create table pcb_private.rate_limits(user_id uuid not null,scope text not null,window_start timestamptz not null,count integer not null,primary key(user_id,scope,window_start));
create or replace function pcb_private.role_for(p_id uuid) returns text language sql stable security definer set search_path='' as $$ select case when auth.uid() is null then null when exists(select 1 from public.pcb_projects where id=p_id and owner_id=auth.uid()) then 'owner' else (select role from public.pcb_project_members where project_id=p_id and user_id=auth.uid()) end $$;
create or replace function pcb_private.can_read(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.pcb_projects where id=p_id and (is_public or (auth.uid() is not null and (owner_id=auth.uid() or exists(select 1 from public.pcb_project_members where project_id=p_id and user_id=auth.uid()))))) $$;
create or replace function pcb_private.can_edit(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce(pcb_private.role_for(p_id) in ('owner','editor'),false) $$;
revoke all on function pcb_private.role_for(uuid),pcb_private.can_read(uuid),pcb_private.can_edit(uuid) from public;
grant execute on function pcb_private.role_for(uuid),pcb_private.can_read(uuid),pcb_private.can_edit(uuid) to authenticated,anon;
alter table public.pcb_profiles enable row level security;
create policy profiles_self on public.pcb_profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant select,insert,update on public.pcb_profiles to authenticated;
alter table public.pcb_projects enable row level security;
create policy projects_read on public.pcb_projects for select to authenticated,anon using(pcb_private.can_read(id));
grant select on public.pcb_projects to authenticated,anon;
revoke insert,update,delete on public.pcb_projects from authenticated,anon;
alter table public.pcb_project_members enable row level security;
create policy members_read on public.pcb_project_members for select to authenticated using(user_id=auth.uid() or pcb_private.role_for(project_id)='owner');
grant select on public.pcb_project_members to authenticated;
revoke insert,update,delete on public.pcb_project_members from authenticated,anon;
alter table public.pcb_versions enable row level security;
alter table public.pcb_version_changes enable row level security;
create policy versions_read on public.pcb_versions for select to authenticated using(pcb_private.role_for(project_id) is not null);
create policy changes_read on public.pcb_version_changes for select to authenticated using(pcb_private.role_for(project_id) is not null);
grant select on public.pcb_versions,public.pcb_version_changes to authenticated;
revoke insert,update,delete on public.pcb_versions,public.pcb_version_changes from authenticated,anon;
alter table public.pcb_comments enable row level security;
create policy comments_read on public.pcb_comments for select to authenticated using(pcb_private.role_for(project_id) is not null);
create policy comments_insert on public.pcb_comments for insert to authenticated with check(author_id=auth.uid() and pcb_private.role_for(project_id) in ('owner','editor','commenter') and (parent_id is null or exists(select 1 from public.pcb_comments parent where parent.id=pcb_comments.parent_id and parent.project_id=pcb_comments.project_id)));
create policy comments_resolve on public.pcb_comments for update to authenticated using(pcb_private.role_for(project_id) in ('owner','editor','commenter')) with check(pcb_private.role_for(project_id) in ('owner','editor','commenter'));
grant select,insert on public.pcb_comments to authenticated;
revoke update on public.pcb_comments from authenticated;
grant update(resolved,updated_at) on public.pcb_comments to authenticated;
alter table public.pcb_ai_plans enable row level security;
create policy ai_plans_read on public.pcb_ai_plans for select to authenticated using(user_id=auth.uid());
create policy ai_plans_insert on public.pcb_ai_plans for insert to authenticated with check(user_id=auth.uid() and not approved);
grant select,insert on public.pcb_ai_plans to authenticated;
alter table public.pcb_ai_actions enable row level security;
create policy ai_actions_read on public.pcb_ai_actions for select to authenticated using(user_id=auth.uid() and pcb_private.can_edit(project_id));
create policy ai_actions_insert on public.pcb_ai_actions for insert to authenticated with check(user_id=auth.uid() and pcb_private.can_edit(project_id) and status='pending');
grant select,insert on public.pcb_ai_actions to authenticated;
alter table public.pcb_invitations enable row level security;
create policy invitation_owner on public.pcb_invitations for select to authenticated using(created_by=auth.uid() and pcb_private.role_for(project_id)='owner');
create policy invitation_create on public.pcb_invitations for insert to authenticated with check(created_by=auth.uid() and pcb_private.role_for(project_id)='owner' and accepted_by is null);
grant select,insert on public.pcb_invitations to authenticated;
alter table public.pcb_subscriptions enable row level security;
alter table public.pcb_usage enable row level security;
alter table public.pcb_webhook_events enable row level security;
create policy subscriptions_read on public.pcb_subscriptions for select to authenticated using(user_id=auth.uid());
create policy usage_read on public.pcb_usage for select to authenticated using(user_id=auth.uid());
grant select on public.pcb_subscriptions,public.pcb_usage to authenticated;
revoke insert,update,delete on public.pcb_subscriptions,public.pcb_usage,public.pcb_webhook_events from anon,authenticated;
-- Service-role writes are confined to verified Stripe webhooks.
grant all on public.pcb_subscriptions,public.pcb_webhook_events to service_role;

create function pcb_private.create_project(p_document jsonb,p_plan_id uuid default null) returns public.pcb_projects language plpgsql security definer set search_path='' as $$
declare p public.pcb_projects; quota integer; begin
 if auth.uid() is null then raise exception 'Unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select case when status in ('active','trialing') and plan='team' then 1000 when status in ('active','trialing') and plan='pro' then 100 else 3 end into quota from public.pcb_subscriptions where user_id=auth.uid();
 if (select count(*) from public.pcb_projects where owner_id=auth.uid())>=coalesce(quota,3) then raise exception 'Project limit reached'; end if;
 if p_plan_id is not null then update public.pcb_ai_plans set approved=true where id=p_plan_id and user_id=auth.uid();if not found then raise exception 'Plan unavailable';end if;end if;
 insert into public.pcb_projects(owner_id,document) values(auth.uid(),p_document) returning * into p;
 insert into public.pcb_versions(project_id,author_id,name,document,revision) values(p.id,auth.uid(),'Project created',p.document,0);return p;
end $$;
create function public.pcb_create_project(p_document jsonb,p_plan_id uuid default null) returns public.pcb_projects language sql security invoker set search_path='' as $$select pcb_private.create_project(p_document,p_plan_id)$$;

create function pcb_private.save_project(p_id uuid,p_revision integer,p_document jsonb,p_description text,p_proposal_id uuid default null) returns public.pcb_projects language plpgsql security definer set search_path='' as $$
declare p public.pcb_projects; begin
 if not pcb_private.can_edit(p_id) then raise exception 'Unauthorized';end if;
 select * into p from public.pcb_projects where id=p_id for update;
 if p.revision<>p_revision then raise exception 'revision_conflict';end if;
 if p_proposal_id is not null then update public.pcb_ai_actions set status='applied',updated_at=now() where id=p_proposal_id and project_id=p_id and user_id=auth.uid() and status='pending' and base_revision=p_revision;if not found then raise exception 'Proposal unavailable';end if;end if;
 insert into public.pcb_version_changes(project_id,author_id,operation,before_state,after_state,revision) values(p_id,auth.uid(),left(p_description,200),p.document,p_document,p.revision+1);
 update public.pcb_projects set document=p_document,revision=revision+1,updated_at=now() where id=p_id returning * into p;return p;
end $$;
create function public.pcb_save_project(p_id uuid,p_revision integer,p_document jsonb,p_description text,p_proposal_id uuid default null) returns public.pcb_projects language sql security invoker set search_path='' as $$select pcb_private.save_project(p_id,p_revision,p_document,p_description,p_proposal_id)$$;
create function pcb_private.checkpoint(p_id uuid,p_revision integer,p_name text) returns public.pcb_versions language plpgsql security definer set search_path='' as $$declare p public.pcb_projects;v public.pcb_versions;begin if not pcb_private.can_edit(p_id) then raise exception 'Unauthorized';end if;select * into p from public.pcb_projects where id=p_id for update;if p.revision<>p_revision then raise exception 'revision_conflict';end if;insert into public.pcb_versions(project_id,author_id,name,document,revision) values(p_id,auth.uid(),left(p_name,120),p.document,p.revision) returning * into v;return v;end$$;
create function public.pcb_checkpoint(p_id uuid,p_revision integer,p_name text) returns public.pcb_versions language sql security invoker set search_path='' as $$select pcb_private.checkpoint(p_id,p_revision,p_name)$$;
create function pcb_private.reject_proposal(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$begin if auth.uid() is null then raise exception 'Unauthorized';end if;update public.pcb_ai_actions set status='rejected',updated_at=now() where id=p_id and user_id=auth.uid() and status='pending' and pcb_private.can_edit(project_id);return found;end$$;
create function public.pcb_reject_proposal(p_id uuid) returns boolean language sql security invoker set search_path='' as $$select pcb_private.reject_proposal(p_id)$$;
create function pcb_private.publish_project(p_id uuid,p_public boolean) returns boolean language plpgsql security definer set search_path='' as $$begin if pcb_private.role_for(p_id) is distinct from 'owner' then raise exception 'Unauthorized';end if;update public.pcb_projects set is_public=p_public where id=p_id;return true;end$$;
create function public.pcb_publish_project(p_id uuid,p_public boolean) returns boolean language sql security invoker set search_path='' as $$select pcb_private.publish_project(p_id,p_public)$$;
create function pcb_private.accept_invitation(p_hash text) returns uuid language plpgsql security definer set search_path='' as $$declare invitation public.pcb_invitations;email_address text;begin if auth.uid() is null then raise exception 'Unauthorized';end if;select email into email_address from auth.users where id=auth.uid() and email_confirmed_at is not null;select * into invitation from public.pcb_invitations where token_hash=p_hash and expires_at>now() and accepted_by is null for update;if not found or lower(invitation.email)<>lower(coalesce(email_address,'')) then raise exception 'Invitation unavailable for this account';end if;insert into public.pcb_project_members(project_id,user_id,role) values(invitation.project_id,auth.uid(),invitation.role) on conflict(project_id,user_id) do update set role=excluded.role;update public.pcb_invitations set accepted_by=auth.uid() where id=invitation.id;return invitation.project_id;end$$;
create function public.pcb_accept_invitation(p_hash text) returns uuid language sql security invoker set search_path='' as $$select pcb_private.accept_invitation(p_hash)$$;
create function pcb_private.consume_rate_limit(p_scope text,p_limit integer) returns boolean language plpgsql security definer set search_path='' as $$declare hits integer;begin if auth.uid() is null then raise exception 'Unauthorized';end if;insert into pcb_private.rate_limits(user_id,scope,window_start,count) values(auth.uid(),left(p_scope,80),date_trunc('minute',now()),1) on conflict(user_id,scope,window_start) do update set count=rate_limits.count+1 returning count into hits;delete from pcb_private.rate_limits where window_start<now()-interval '1 day';return hits<=least(greatest(p_limit,1),100);end$$;
create function public.pcb_consume_rate_limit(p_scope text,p_limit integer) returns boolean language sql security invoker set search_path='' as $$select pcb_private.consume_rate_limit(p_scope,p_limit)$$;
create function pcb_private.consume_ai() returns boolean language plpgsql security definer set search_path='' as $$declare used integer;quota integer;begin if auth.uid() is null then raise exception 'Unauthorized';end if;select case when status in ('active','trialing') and plan='team' then 2000 when status in ('active','trialing') and plan='pro' then 500 else 20 end into quota from public.pcb_subscriptions where user_id=auth.uid();insert into public.pcb_usage(user_id,ai_requests) values(auth.uid(),1) on conflict(user_id,month) do update set ai_requests=pcb_usage.ai_requests+1 returning ai_requests into used;return used<=coalesce(quota,20);end$$;
create function public.pcb_consume_ai() returns boolean language sql security invoker set search_path='' as $$select pcb_private.consume_ai()$$;
create function pcb_private.record_usage(p_tokens integer default 0,p_simulations integer default 0,p_exports integer default 0) returns void language plpgsql security definer set search_path='' as $$begin if auth.uid() is null then raise exception 'Unauthorized';end if;insert into public.pcb_usage(user_id,ai_tokens,simulations,exports) values(auth.uid(),greatest(p_tokens,0),greatest(p_simulations,0),greatest(p_exports,0)) on conflict(user_id,month) do update set ai_tokens=pcb_usage.ai_tokens+greatest(p_tokens,0),simulations=pcb_usage.simulations+greatest(p_simulations,0),exports=pcb_usage.exports+greatest(p_exports,0);end$$;
create function public.pcb_record_usage(p_tokens integer default 0,p_simulations integer default 0,p_exports integer default 0) returns void language sql security invoker set search_path='' as $$select pcb_private.record_usage(p_tokens,p_simulations,p_exports)$$;
-- Restrict all private mutation helpers and corresponding public RPC wrappers.
do $$declare f record;begin for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='pcb_private' and p.proname not in ('role_for','can_read','can_edit')) or (n.nspname='public' and p.proname like 'pcb_%') loop execute format('revoke all on function %I.%I(%s) from public,anon',f.nspname,f.proname,f.args);execute format('grant execute on function %I.%I(%s) to authenticated',f.nspname,f.proname,f.args);end loop;end$$;

-- Project-scoped normalized extension records. Design arrays remain authoritative until an adapter materializes them.
do $$declare t text;begin foreach t in array array['project_requirements','schematic_pages','component_instances','pins','nets','net_connections','pcb_boards','pcb_components','traces','vias','zones','design_rules','drc_results','erc_results','bom_items','simulations','simulation_results','ai_conversations','ai_messages','activity','manufacturing_exports'] loop execute format('create table public.pcb_%I(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.pcb_projects(id) on delete cascade,data jsonb not null default ''{}'',created_at timestamptz not null default now(),updated_at timestamptz not null default now())',t);execute format('alter table public.pcb_%I enable row level security',t);execute format('create policy project_read on public.pcb_%I for select to authenticated using(pcb_private.role_for(project_id) is not null)',t);execute format('create policy project_write on public.pcb_%I for all to authenticated using(pcb_private.can_edit(project_id)) with check(pcb_private.can_edit(project_id))',t);execute format('grant select,insert,update,delete on public.pcb_%I to authenticated',t);execute format('create index on public.pcb_%I(project_id)',t);end loop;end$$;
do $$declare t text;begin foreach t in array array['components','footprints','component_libraries','custom_components','templates'] loop execute format('create table public.pcb_%I(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),name text not null,data jsonb not null default ''{}'',is_public boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now())',t);execute format('alter table public.pcb_%I enable row level security',t);execute format('create policy library_read on public.pcb_%I for select to authenticated using(owner_id=auth.uid() or is_public)',t);execute format('create policy library_write on public.pcb_%I for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid())',t);execute format('grant select,insert,update,delete on public.pcb_%I to authenticated',t);end loop;end$$;
commit;
