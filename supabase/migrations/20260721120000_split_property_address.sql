alter table public.properties
  add column if not exists street text,
  add column if not exists house_number text,
  add column if not exists postal_code text,
  add column if not exists city text;

update public.properties set
  street = coalesce(street, ''),
  house_number = coalesce(house_number, ''),
  postal_code = coalesce(postal_code, ''),
  city = coalesce(city, '')
where street is null or house_number is null or postal_code is null or city is null;

alter table public.properties
  alter column street set not null,
  alter column house_number set not null,
  alter column postal_code set not null,
  alter column city set not null;

alter table public.properties drop column address;
