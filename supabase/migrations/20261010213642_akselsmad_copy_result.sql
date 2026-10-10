create or replace function public.am_copy_to_kitchen(p_id uuid,p_household_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare c jsonb; v_id uuid;
begin
 if auth.uid() is null or not private.has_household_role(p_household_id,'member') then raise exception 'forbidden' using errcode='42501'; end if;
 select content into c from public.am_recipes where id=p_id and visible;
 if c is null then raise exception 'recipe_not_available' using errcode='22023'; end if;
 -- This is a one-time independent copy. Public photo files are not injected into private storage.
 c=(c-'category'-'category_id'-'difficulty'-'equipment'-'tips'-'storage'-'freezing'-'variations'-'troubleshooting'-'baking'-'cover_path') || jsonb_build_object('household_id',p_household_id,'source_type','other','source_name','AkselsMad','difficulty',null,'tags','[]'::jsonb,'ingredients',(select jsonb_agg(value||jsonb_build_object('position',ordinality-1)) from jsonb_array_elements(c->'ingredients') with ordinality),'steps',(select jsonb_agg(value||jsonb_build_object('position',ordinality-1)) from jsonb_array_elements(c->'steps') with ordinality),'notes',concat_ws(E'\n\n',nullif(c->>'notes',''),nullif(c->>'equipment',''),nullif(c->>'tips',''),nullif(c->>'storage',''),nullif(c->>'freezing',''),nullif(c->>'variations',''),nullif(c->>'troubleshooting',''),nullif(c->>'baking','')));
 v_id=(public.save_recipe(c)->>'id')::uuid;
 return v_id;
end $$;

