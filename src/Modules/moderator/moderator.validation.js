import joi from "joi";
import { generalFeilds, validateInternationalPhoneLength } from "../../Utils/GeneralFields/index.js";

const getAllModerators = {
  query: joi.object({
    page: generalFeilds.page.required(),
    limit: generalFeilds.limit.required(),
    search: generalFeilds.search.optional(),
    order: generalFeilds.order.optional(),
    orderBy: generalFeilds.orderBy.valid("createdAt", "active").when("order", {
      is: joi.exist(),
      then: joi.required(),
      otherwise: joi.optional(),
    }),
  }),
};

const createModerator = {
  body: joi
    .object({
      name: joi.string().required(),
      codeCountry:generalFeilds.codeCountry.required(),
      email: generalFeilds.email.required(),
      password: generalFeilds.password.required(),
      phone: generalFeilds.phone.optional(),
      age: generalFeilds.age.required(),
      gender: generalFeilds.gender.required(),
      studentIds: joi.array().items(generalFeilds.id).required(),
    })
    .custom(
      validateInternationalPhoneLength({
        codeCountryKey: "codeCountry",
      }),
    )
    .messages({
      "phone.e164Length": "PHONE_E164_MAX_LENGTH",
    })
    .required(),
};

const getModeratorById = {
  params: joi
    .object({
      id: generalFeilds.id.required(),
    })
    .required(),
};

const updateModerator = {
  params: joi
    .object({
      id: generalFeilds.id.required(),
    })
    .required(),
  body: joi
    .object({
      name: joi.string().optional(),
      codeCountry: generalFeilds.codeCountry.optional(),
      email: generalFeilds.email.optional(),
      password: generalFeilds.password.optional(),
      phone: generalFeilds.phone.optional(),
      age: generalFeilds.age.optional(),
      gender: generalFeilds.gender.optional(),
      status: joi.string().valid("active", "inactive", "pending").optional(),
      studentIds: joi.array().items(generalFeilds.id).optional(),
    })
    .custom(
      validateInternationalPhoneLength({
        codeCountryKey: "codeCountry",
      }),
    )
    .required(),
};

const deleteModerator = {
  params: joi
    .object({
      id: generalFeilds.id.required(),
    })
    .required(),
};

export { getAllModerators, createModerator, getModeratorById, updateModerator, deleteModerator };
